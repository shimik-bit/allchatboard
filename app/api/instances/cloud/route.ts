import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getPhoneNumberInfo } from '@/lib/instances/cloud-api-client';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * POST /api/instances/cloud
 *
 * Create a new Meta WhatsApp Cloud API instance for a workspace. Unlike
 * the Green API flow (QR code scan), Cloud API needs four pieces of info
 * pasted in by the user, all from their Meta Business / Developer setup:
 *
 *   - phone_number_id   — the WhatsApp Business phone number ID
 *   - access_token      — long-lived (System User) access token
 *   - business_account_id — the WABA id (used for some Graph API calls)
 *   - app_secret (optional but recommended) — for signing webhook payloads
 *
 * On success we:
 *   1. Verify the creds by calling Meta's Graph API for phone-number metadata
 *   2. Generate a webhook_verify_token (random) the user will configure on
 *      Meta's side
 *   3. Store everything in whatsapp_instances with provider='meta'
 *   4. Return the webhook URL + verify token so the user can finish
 *      setup in their Meta dashboard
 */

type Body = {
  workspace_id: string;
  display_name: string;
  phone_number_id: string;
  access_token: string;
  business_account_id?: string;
  app_id?: string;
  app_secret?: string;
};

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  // Required fields. We're strict: missing the two must-haves yields 400
  // rather than getting deeper and erroring on Meta's side.
  if (!body.workspace_id || !body.display_name || !body.phone_number_id || !body.access_token) {
    return NextResponse.json(
      { error: 'workspace_id, display_name, phone_number_id, access_token are required' },
      { status: 400 },
    );
  }

  // Authorization: only owner/admin can connect new providers
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', body.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'Only workspace owners/admins can connect a Cloud API instance' },
      { status: 403 },
    );
  }

  // Verify creds by hitting Meta. This catches typos in phone_number_id
  // and expired access tokens before we save anything.
  const verifyResult = await getPhoneNumberInfo({
    phoneNumberId: body.phone_number_id,
    accessToken: body.access_token,
  });

  if (!verifyResult.ok) {
    return NextResponse.json(
      {
        error: 'creds verification failed against Meta Graph API',
        detail: verifyResult.error,
      },
      { status: 400 },
    );
  }

  const { display_phone_number, verified_name, quality_rating } = verifyResult.data;

  // Generate a random verify token. The user will paste this into their
  // Meta app's webhook configuration page. We store it so the GET handshake
  // (in cloud-webhook/route.ts) can compare what Meta sends back.
  const verifyToken = randomBytes(32).toString('hex');

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Strip the leading "+" from display_phone_number so it matches our
  // existing convention (we store digits-only in phone_number).
  const phoneDigits = display_phone_number.replace(/^\+/, '').replace(/\s/g, '');

  const { data: inserted, error: insertErr } = await admin
    .from('whatsapp_instances')
    .insert({
      workspace_id: body.workspace_id,
      provider: 'meta',
      provider_instance_id: body.phone_number_id,
      provider_token: body.access_token,
      provider_account_id: body.business_account_id ?? null,
      provider_metadata: {
        webhook_verify_token: verifyToken,
        business_account_id: body.business_account_id ?? null,
        app_id: body.app_id ?? null,
        app_secret: body.app_secret ?? null,
        verified_name,
        quality_rating: quality_rating ?? null,
      },
      display_name: body.display_name,
      phone_number: phoneDigits,
      state: 'authorized',
      state_message: 'מחובר ל-Meta Cloud API',
      authorized_at: new Date().toISOString(),
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insertErr || !inserted) {
    console.error('[instances/cloud] insert failed:', insertErr);
    return NextResponse.json(
      { error: insertErr?.message || 'Failed to save instance' },
      { status: 500 },
    );
  }

  // Build the webhook URL the user needs to paste into Meta's app config.
  const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;
  const webhookUrl = `${origin}/api/whatsapp/cloud-webhook?instance=${inserted.id}`;

  return NextResponse.json({
    ok: true,
    instance_id: inserted.id,
    setup: {
      webhook_url: webhookUrl,
      webhook_verify_token: verifyToken,
      instructions: [
        'Go to your Meta App → WhatsApp → Configuration',
        `Set Callback URL to: ${webhookUrl}`,
        `Set Verify Token to: ${verifyToken}`,
        'Subscribe to webhook fields: messages, message_status_updates',
      ],
    },
    phone: {
      display_phone_number,
      verified_name,
      quality_rating,
    },
  });
}
