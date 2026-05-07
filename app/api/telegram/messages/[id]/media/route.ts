import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  downloadAndStoreMedia,
  extractFileId,
} from '@/lib/telegram/media';

interface RouteContext {
  params: { id: string };
}

/**
 * POST /api/telegram/messages/[id]/media
 *
 * Triggers a lazy download of the media for an inbound message:
 *  1. Fetch raw_payload from the row
 *  2. Extract the right file_id (depending on photo / video / document / etc.)
 *  3. Call Telegram's getFile, download the bytes
 *  4. Upload to Supabase Storage (bucket: media, path: telegram/{bot_id}/{message_id}/{filename})
 *  5. Update the message row with media_url and return it
 *
 * If media_url is already set, returns it immediately (no-op).
 *
 * RLS via the user-scoped client validates workspace membership before
 * we touch the admin client for the actual download.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id } = params;
  const supabase = createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 1. Read message via user client (RLS ensures workspace access)
  const { data: msg, error: msgError } = await supabase
    .from('telegram_messages')
    .select('id, bot_id, chat_id, content_type, media_url, raw_payload')
    .eq('id', id)
    .single();

  if (msgError || !msg) {
    return NextResponse.json({ error: 'Message not found' }, { status: 404 });
  }

  // Already downloaded? Return what we have.
  if (msg.media_url) {
    return NextResponse.json({ media_url: msg.media_url, cached: true });
  }

  // Text/sticker/contact/location/service messages have no downloadable file
  const NO_DOWNLOAD = new Set([
    'text',
    'service',
    'location',
    'contact',
    'other',
  ]);
  if (NO_DOWNLOAD.has(msg.content_type)) {
    return NextResponse.json(
      { error: `No file to download for content_type=${msg.content_type}` },
      { status: 400 }
    );
  }

  // 2. Extract file_id from raw payload
  const fileInfo = extractFileId(msg.raw_payload);
  if (!fileInfo) {
    return NextResponse.json(
      { error: 'Could not extract file_id from raw payload' },
      { status: 400 }
    );
  }

  // 3. Get bot token (admin client — we already verified access above)
  const { data: bot, error: botError } = await admin
    .from('telegram_bots')
    .select('bot_token_encrypted, bot_token_iv, bot_token_auth_tag')
    .eq('id', msg.bot_id)
    .single();

  if (botError || !bot) {
    return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
  }

  // 4. Download + upload to Storage
  const safeName = (fileInfo.fileName || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `telegram/${msg.bot_id}/${msg.id}/${safeName}`;

  let publicUrl: string;
  try {
    publicUrl = await downloadAndStoreMedia(
      admin,
      bot,
      fileInfo.fileId,
      storagePath
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Download failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  // 5. Persist the URL on the message row
  const { error: updateError } = await admin
    .from('telegram_messages')
    .update({
      media_url: publicUrl,
      media_file_name: fileInfo.fileName ?? null,
    })
    .eq('id', id);

  if (updateError) {
    // Storage upload succeeded but we couldn't update the row — the file
    // is still accessible at the URL. Return it so the UI can show the file,
    // and we'll re-update on next view.
    console.error('[telegram-media] update failed', updateError);
  }

  return NextResponse.json({ media_url: publicUrl, cached: false });
}
