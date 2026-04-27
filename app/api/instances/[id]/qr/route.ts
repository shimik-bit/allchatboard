import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getQrCode, getInstanceState, getInstanceDetails, extractPhoneFromWid } from '@/lib/instances/green-api-client';

export const runtime = 'nodejs';
export const maxDuration = 30;

/**
 * GET /api/instances/[id]/qr
 * Returns the current QR code for an instance.
 * If already authorized, returns status only.
 *
 * Polls Green API. Frontend should poll this every ~5 seconds while showing QR
 * to detect when user successfully scanned.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();
  if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || !['owner', 'admin'].includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    // Check current state first
    const state = await getInstanceState(instance.provider_instance_id, instance.provider_token);

    // Update last_check_at
    await service.from('whatsapp_instances')
      .update({ last_check_at: new Date().toISOString() })
      .eq('id', params.id);

    if (state === 'authorized') {
      // Already connected - update DB if state changed
      if (instance.state !== 'authorized') {
        // Get phone number while we're at it
        const details = await getInstanceDetails(instance.provider_instance_id, instance.provider_token);
        const phoneNumber = extractPhoneFromWid(details.wid);

        await service.from('whatsapp_instances')
          .update({
            state: 'authorized',
            state_message: 'מחובר',
            state_updated_at: new Date().toISOString(),
            authorized_at: instance.authorized_at || new Date().toISOString(),
            phone_number: phoneNumber,
          })
          .eq('id', params.id);

        await service.from('instance_provisioning_log').insert({
          instance_id: params.id,
          workspace_id: instance.workspace_id,
          user_id: user.id,
          action: 'qr_scanned',
          state_before: instance.state,
          state_after: 'authorized',
          details: { phone_number: phoneNumber },
        });
      }

      return NextResponse.json({
        status: 'authorized',
        message: 'WhatsApp מחובר בהצלחה',
      });
    }

    // Not authorized - get QR
    const qrResult = await getQrCode(instance.provider_instance_id, instance.provider_token);

    if (qrResult.type === 'qrCode') {
      // Update state to awaiting_qr if not already
      if (instance.state !== 'awaiting_qr' && instance.state !== 'scanning') {
        await service.from('whatsapp_instances')
          .update({
            state: 'awaiting_qr',
            state_updated_at: new Date().toISOString(),
          })
          .eq('id', params.id);
      }

      return NextResponse.json({
        status: 'qr',
        qr_base64: qrResult.message,  // Already base64-encoded PNG
        provider_state: state,
      });
    }

    if (qrResult.type === 'alreadyLogged') {
      return NextResponse.json({
        status: 'authorized',
        message: 'כבר מחובר',
      });
    }

    return NextResponse.json({
      status: 'error',
      message: qrResult.message || 'Failed to get QR code',
    }, { status: 500 });
  } catch (err: any) {
    return NextResponse.json({
      status: 'error',
      message: err.message,
    }, { status: 500 });
  }
}
