/**
 * Telegram media download → Supabase Storage.
 *
 * Telegram doesn't give us direct URLs for media — we have to call getFile,
 * receive a temporary file_path, then download from
 * https://api.telegram.org/file/bot{token}/{file_path}. The temp URL only
 * works for ~1 hour, so we eagerly persist the file in Supabase Storage
 * (bucket "media") and store the resulting public URL on the message row.
 *
 * This runs lazily — on the first time the UI loads a message that has a
 * media file_id but no media_url. That keeps the webhook handler fast and
 * means we never download media for messages no one ever views.
 */

import { decryptToken } from './encryption';
import { getFile, downloadFileUrl } from './bot-api';

interface BotRow {
  bot_token_encrypted: string;
  bot_token_iv: string;
  bot_token_auth_tag: string;
}

/**
 * Download a Telegram file and upload it to Supabase Storage.
 * Returns the public URL of the stored file.
 *
 * @param admin - Supabase service-role client
 * @param bot - Bot row with encrypted token columns
 * @param fileId - Telegram file_id from a message
 * @param storagePath - Where to store it (e.g. "telegram/{bot_id}/{message_id}/photo.jpg")
 */
export async function downloadAndStoreMedia(
  admin: any,
  bot: BotRow,
  fileId: string,
  storagePath: string
): Promise<string> {
  // 1. Decrypt the bot token
  const token = decryptToken({
    encrypted: bot.bot_token_encrypted,
    iv: bot.bot_token_iv,
    authTag: bot.bot_token_auth_tag,
  });

  // 2. Ask Telegram where the file lives
  const fileInfo = await getFile(token, fileId);
  if (!fileInfo.file_path) {
    throw new Error('Telegram returned no file_path');
  }

  // 3. Download from the temporary URL
  const downloadUrl = downloadFileUrl(token, fileInfo.file_path);
  const res = await fetch(downloadUrl, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType =
    res.headers.get('content-type') ?? 'application/octet-stream';

  // 4. Upload to Supabase Storage (bucket: media — already exists, public)
  const { error: uploadError } = await admin.storage
    .from('media')
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // tolerate retries
    });

  if (uploadError) {
    throw new Error(`Storage upload failed: ${uploadError.message}`);
  }

  // 5. Get the public URL
  const { data } = admin.storage.from('media').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Extract the relevant file_id from a message's raw payload.
 * Telegram puts media file_ids in different places depending on the type.
 */
export function extractFileId(rawPayload: any): {
  fileId: string;
  fileName?: string;
} | null {
  const msg = rawPayload?.message ?? rawPayload?.edited_message;
  if (!msg) return null;

  if (msg.photo && msg.photo.length > 0) {
    // Telegram sends multiple sizes; the largest is last
    const largest = msg.photo[msg.photo.length - 1];
    return { fileId: largest.file_id, fileName: 'photo.jpg' };
  }
  if (msg.video) {
    return { fileId: msg.video.file_id, fileName: 'video.mp4' };
  }
  if (msg.voice) {
    return { fileId: msg.voice.file_id, fileName: 'voice.ogg' };
  }
  if (msg.audio) {
    return {
      fileId: msg.audio.file_id,
      fileName: msg.audio.file_name ?? 'audio.mp3',
    };
  }
  if (msg.document) {
    return {
      fileId: msg.document.file_id,
      fileName: msg.document.file_name ?? 'document',
    };
  }
  if (msg.animation) {
    return { fileId: msg.animation.file_id, fileName: 'animation.gif' };
  }
  if (msg.sticker) {
    return { fileId: msg.sticker.file_id, fileName: 'sticker.webp' };
  }

  return null;
}
