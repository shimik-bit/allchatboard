/**
 * Green API Client - both Instance-level and Partner-level operations.
 *
 * THREE TIERS OF API:
 *
 * 1. INSTANCE API (per-instance, requires instance_id + api_token):
 *    https://7107.api.green-api.com/waInstance{instance_id}/{method}/{api_token}
 *    Used for: send messages, get state, set webhooks, get QR code
 *
 * 2. PARTNER API (account-level, requires partner_token):
 *    https://api.green-api.com/partner/{method}/{partner_token}
 *    Used for: create/delete instances. Requires Partner program enrollment.
 *
 * 3. PUBLIC API (no auth):
 *    https://api.green-api.com/{method}
 *    Used for: pricing info, health checks
 */

const GREEN_API_BASE = 'https://api.green-api.com';

// Partner token comes from env (set by platform admin once)
const PARTNER_TOKEN = process.env.GREEN_API_PARTNER_TOKEN;

// ─── Types ───
export type InstanceState =
  | 'notAuthorized'   // Created but no QR scanned
  | 'authorized'      // Connected to WhatsApp
  | 'blocked'         // Phone account blocked
  | 'sleepMode'       // Inactive
  | 'starting'        // Booting up
  | 'yellowCard'      // WhatsApp warning
  | 'unknown';        // No state yet

export type GreenApiInstance = {
  idInstance: number;       // Returned as number from API, we store as string
  apiTokenInstance: string;
  typeInstance: string;     // 'developer' | 'mini' | 'business' | 'pro'
  paymentExpiredDate?: number;  // Unix timestamp
};

// ─── Partner API: Create instance ───
export async function createInstance(opts: {
  paymentType?: 'developer' | 'mini' | 'business' | 'pro';
  email?: string;
  paymentPeriod?: 'month' | 'year';  // For paid plans
}): Promise<GreenApiInstance> {
  if (!PARTNER_TOKEN) {
    throw new Error(
      'GREEN_API_PARTNER_TOKEN not configured. Get a partner token from https://green-api.com/partners/'
    );
  }

  const res = await fetch(
    `${GREEN_API_BASE}/partner/createInstance/${PARTNER_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Default to developer (free, 14-day trial)
        paymentType: opts.paymentType || 'developer',
        ...(opts.email ? { email: opts.email } : {}),
        ...(opts.paymentPeriod ? { paymentPeriod: opts.paymentPeriod } : {}),
      }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Green API createInstance failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  if (!data.idInstance || !data.apiTokenInstance) {
    throw new Error('Invalid response from Green API: ' + JSON.stringify(data));
  }

  return {
    idInstance: data.idInstance,
    apiTokenInstance: data.apiTokenInstance,
    typeInstance: data.typeInstance || opts.paymentType || 'developer',
    paymentExpiredDate: data.paymentExpiredDate,
  };
}

// ─── Partner API: Delete instance ───
export async function deleteInstance(instanceId: string | number): Promise<boolean> {
  if (!PARTNER_TOKEN) {
    throw new Error('GREEN_API_PARTNER_TOKEN not configured');
  }

  const res = await fetch(
    `${GREEN_API_BASE}/partner/deleteInstanceAccount/${PARTNER_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idInstance: Number(instanceId) }),
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Green API deleteInstance failed (${res.status}): ${errorText}`);
  }

  return true;
}

// ─── Partner API: List all instances under partner account ───
export async function getPartnerInstances(): Promise<Array<{
  idInstance: number;
  typeInstance: string;
  apiTokenInstance: string;
  paymentExpiredDate?: number;
}>> {
  if (!PARTNER_TOKEN) {
    throw new Error('GREEN_API_PARTNER_TOKEN not configured');
  }

  const res = await fetch(
    `${GREEN_API_BASE}/partner/getInstances/${PARTNER_TOKEN}`
  );

  if (!res.ok) {
    throw new Error(`Green API getInstances failed: ${await res.text()}`);
  }

  return await res.json();
}

// ─── Instance API: get current state ───
export async function getInstanceState(
  instanceId: string,
  apiToken: string
): Promise<InstanceState> {
  // Pick the right base URL — Green API has multiple (7103, 7107, etc.)
  const baseUrl = getInstanceBaseUrl(instanceId);
  const url = `${baseUrl}/waInstance${instanceId}/getStateInstance/${apiToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    return 'unknown';
  }

  const data = await res.json();
  return (data?.stateInstance || 'unknown') as InstanceState;
}

// ─── Instance API: get QR code (base64 image) ───
export async function getQrCode(
  instanceId: string,
  apiToken: string
): Promise<{ type: 'qrCode'; message: string } | { type: 'alreadyLogged'; message: string } | { type: 'error'; message: string }> {
  const baseUrl = getInstanceBaseUrl(instanceId);
  const url = `${baseUrl}/waInstance${instanceId}/qr/${apiToken}`;

  const res = await fetch(url);
  if (!res.ok) {
    return { type: 'error', message: `HTTP ${res.status}: ${await res.text()}` };
  }

  const data = await res.json();

  // Possible responses:
  // { type: "qrCode", message: "iVBOR...base64..." } - QR ready
  // { type: "alreadyLogged", message: "Instance is already authorized" }
  // { type: "error", message: "..." }
  return data;
}

// ─── Instance API: set webhook URL + enable incoming notifications ───
export async function setWebhook(
  instanceId: string,
  apiToken: string,
  webhookUrl: string
): Promise<boolean> {
  const baseUrl = getInstanceBaseUrl(instanceId);

  // SetSettings is the unified endpoint for all instance settings
  const url = `${baseUrl}/waInstance${instanceId}/setSettings/${apiToken}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl,
      webhookUrlToken: '',  // No additional auth - we verify via workspace_id param
      outgoingWebhook: 'no',  // We only care about incoming
      outgoingMessageWebhook: 'no',
      outgoingAPIMessageWebhook: 'no',
      incomingWebhook: 'yes',  // Get notifications for incoming messages
      stateWebhook: 'yes',     // Get notifications for state changes (auth/expire)
      deviceWebhook: 'yes',    // Get notifications for device changes
    }),
  });

  if (!res.ok) {
    throw new Error(`setSettings failed: ${await res.text()}`);
  }

  return true;
}

// ─── Instance API: log out (disconnect WhatsApp without deleting instance) ───
export async function logoutInstance(
  instanceId: string,
  apiToken: string
): Promise<boolean> {
  const baseUrl = getInstanceBaseUrl(instanceId);
  const url = `${baseUrl}/waInstance${instanceId}/logout/${apiToken}`;

  const res = await fetch(url);
  return res.ok;
}

// ─── Instance API: get instance details (phone number, name, etc.) ───
export async function getInstanceDetails(
  instanceId: string,
  apiToken: string
): Promise<{ wid?: string; name?: string; avatar?: string }> {
  const baseUrl = getInstanceBaseUrl(instanceId);
  const url = `${baseUrl}/waInstance${instanceId}/getWaSettings/${apiToken}`;

  const res = await fetch(url);
  if (!res.ok) return {};

  const data = await res.json();
  return {
    wid: data?.wid,             // "972501234567@c.us"
    name: data?.name,
    avatar: data?.avatar,
  };
}

// ─── Helper: pick the right base URL for an instance ───
// Green API uses different sub-domains per ID range to distribute load.
// The exact mapping is documented in their API but the prefix of the ID
// usually indicates the host. Default is api.green-api.com which redirects.
function getInstanceBaseUrl(instanceId: string): string {
  // For most instances, using their generic domain works:
  // https://7107.api.green-api.com (works for IDs starting with 7107)
  // But the safest is to use api.green-api.com which auto-redirects.
  const prefix = instanceId.substring(0, 4);
  return `https://${prefix}.api.green-api.com`;
}

// ─── Public utility: extract phone from WID ───
export function extractPhoneFromWid(wid?: string): string | null {
  if (!wid) return null;
  // Format: "972501234567@c.us" or "972501234567@s.whatsapp.net"
  const match = wid.match(/^(\d+)@/);
  return match ? `+${match[1]}` : null;
}

// ─── Check if Partner token is configured ───
export function hasPartnerToken(): boolean {
  return !!PARTNER_TOKEN;
}
