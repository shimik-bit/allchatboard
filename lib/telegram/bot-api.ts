/**
 * Minimal Telegram Bot API client.
 *
 * Phase 1 only needs: getMe (validate token), setWebhook, deleteWebhook.
 * Phase 2 will add sendMessage, sendPhoto, getFile, etc.
 *
 * Docs: https://core.telegram.org/bots/api
 */

const TELEGRAM_API = 'https://api.telegram.org';

export interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public errorCode?: number
  ) {
    super(message);
    this.name = 'TelegramApiError';
  }
}

async function callTelegram<T>(
  token: string,
  method: string,
  params?: Record<string, unknown>
): Promise<T> {
  const url = `${TELEGRAM_API}/bot${token}/${method}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: params ? JSON.stringify(params) : undefined,
      // Telegram is fast — fail fast if it isn't responding
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    throw new TelegramApiError(
      `Network error contacting Telegram: ${(e as Error).message}`
    );
  }

  let data: TelegramResponse<T>;
  try {
    data = await response.json();
  } catch {
    throw new TelegramApiError(
      `Invalid JSON from Telegram (HTTP ${response.status})`
    );
  }

  if (!data.ok) {
    throw new TelegramApiError(
      data.description || 'Unknown Telegram error',
      data.error_code
    );
  }

  return data.result as T;
}

/**
 * Validates a token by calling getMe. Returns bot info on success.
 * Throws TelegramApiError if the token is invalid.
 */
export function getBotInfo(token: string): Promise<BotInfo> {
  return callTelegram<BotInfo>(token, 'getMe');
}

/**
 * Registers a webhook URL. Telegram will POST updates to this URL.
 *
 * @param token - Bot token
 * @param url - Public HTTPS URL (must be reachable from Telegram servers)
 * @param secret - Secret token sent back in X-Telegram-Bot-Api-Secret-Token header
 */
export function setWebhook(
  token: string,
  url: string,
  secret: string
): Promise<true> {
  return callTelegram<true>(token, 'setWebhook', {
    url,
    secret_token: secret,
    allowed_updates: ['message', 'edited_message', 'callback_query'],
    drop_pending_updates: false,
  });
}

/**
 * Removes the webhook. Used when deleting or disabling a bot.
 */
export function deleteWebhook(token: string): Promise<true> {
  return callTelegram<true>(token, 'deleteWebhook', {
    drop_pending_updates: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Sending
// ─────────────────────────────────────────────────────────────────────────

export interface SentMessage {
  message_id: number;
  date: number;
  chat: { id: number; type: string };
  text?: string;
  caption?: string;
}

/**
 * Send a text message to a chat.
 *
 * @param chatId - Telegram chat id (positive for users, negative for groups)
 * @param replyToMessageId - if set, message will be sent as a reply
 */
export function sendMessage(
  token: string,
  chatId: number,
  text: string,
  replyToMessageId?: number
): Promise<SentMessage> {
  return callTelegram<SentMessage>(token, 'sendMessage', {
    chat_id: chatId,
    text,
    ...(replyToMessageId
      ? { reply_parameters: { message_id: replyToMessageId } }
      : {}),
  });
}

/**
 * Send a photo by URL or file_id. To send a local file, you'd need a
 * multipart upload — Phase 2 only sends URLs we already have.
 */
export function sendPhoto(
  token: string,
  chatId: number,
  photo: string,
  caption?: string
): Promise<SentMessage> {
  return callTelegram<SentMessage>(token, 'sendPhoto', {
    chat_id: chatId,
    photo,
    ...(caption ? { caption } : {}),
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Media
// ─────────────────────────────────────────────────────────────────────────

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  /** Path on Telegram's file server, used to construct the download URL. */
  file_path?: string;
}

/**
 * getFile returns metadata including a file_path that's valid for at least
 * 1 hour. Use it with the downloadFileUrl helper to get a usable URL.
 */
export function getFile(token: string, fileId: string): Promise<TelegramFile> {
  return callTelegram<TelegramFile>(token, 'getFile', { file_id: fileId });
}

/**
 * Build the temporary download URL for a Telegram-hosted file.
 * The URL works for ~1 hour from the getFile call.
 */
export function downloadFileUrl(token: string, filePath: string): string {
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}
