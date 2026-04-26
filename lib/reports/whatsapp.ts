/**
 * WhatsApp send helper - centralized so all features (webhook, reports,
 * notifications) use the same Green API integration.
 */

export type SendResult =
  | { ok: true; message_id?: string }
  | { ok: false; error: string };

/**
 * Send a WhatsApp text message via Green API.
 *
 * @param instanceId - workspace.whatsapp_instance_id
 * @param token      - workspace.whatsapp_token
 * @param phone      - E.164 (e.g. 972501234567) or Israeli format (0501234567)
 * @param text       - Message body (WhatsApp markdown supported)
 */
export async function sendWhatsAppText(
  instanceId: string,
  token: string,
  phone: string,
  text: string
): Promise<SendResult> {
  // Normalize phone: strip non-digits, convert 05xx → 9725xx
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('0')) {
    normalized = '972' + normalized.slice(1);
  }

  // chatId for Green API: 9725XXXXXXXX@c.us for individual, group@g.us for groups
  const chatId = normalized.includes('@') ? normalized : `${normalized}@c.us`;

  const url = `https://api.green-api.com/waInstance${instanceId}/sendMessage/${token}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId,
        message: text,
        // Disable link preview in reports — too much visual clutter
        linkPreview: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { ok: true, message_id: data.idMessage };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'unknown send error' };
  }
}
