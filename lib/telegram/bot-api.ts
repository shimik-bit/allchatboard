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
