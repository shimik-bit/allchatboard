import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { getInstanceState, getInstanceDetails, extractPhoneFromWid } from '@/lib/instances/green-api-client';

export const runtime = 'nodejs';

/**
 * GET /api/instances/[id]/status
 * Force-refresh the instance state from Green API.
 * Useful for the polling UI to detect when QR was scanned.
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

  // Members can check status (not just admins)
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', instance.workspace_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  try {
    const providerState = await getInstanceState(instance.provider_instance_id, instance.provider_token);

    let newDbState = instance.state;
    let stateMessage = instance.state_message;
    let phoneNumber = instance.phone_number;

    // Map Green API states to our internal states
    if (providerState === 'authorized') {
      newDbState = 'authorized';
      stateMessage = 'מחובר ופעיל';
      // Try to get phone if we don't have it
      if (!phoneNumber) {
        try {
          const details = await getInstanceDetails(instance.provider_instance_id, instance.provider_token);
          phoneNumber = extractPhoneFromWid(details.wid);
        } catch {}
      }
    } else if (providerState === 'notAuthorized') {
      newDbState = instance.authorized_at ? 'expired' : 'awaiting_qr';
      stateMessage = instance.authorized_at ? 'אישור פג תוקף - יש לסרוק QR מחדש' : 'ממתין לסריקת QR';
    } else if (providerState === 'blocked') {
      newDbState = 'failed';
      stateMessage = 'החשבון חסום על ידי WhatsApp';
    } else if (providerState === 'starting') {
      newDbState = 'created';
      stateMessage = 'נטען...';
    } else if (providerState === 'sleepMode') {
      stateMessage = 'במצב חסכוני - יתעורר בהודעה הבאה';
    }

    // Update DB if state changed
    if (newDbState !== instance.state || phoneNumber !== instance.phone_number) {
      await service.from('whatsapp_instances')
        .update({
          state: newDbState,
          state_message: stateMessage,
          state_updated_at: new Date().toISOString(),
          last_check_at: new Date().toISOString(),
          phone_number: phoneNumber,
          ...(newDbState === 'authorized' && !instance.authorized_at
            ? { authorized_at: new Date().toISOString() }
            : {}),
        })
        .eq('id', params.id);

      if (newDbState !== instance.state) {
        await service.from('instance_provisioning_log').insert({
          instance_id: params.id,
          workspace_id: instance.workspace_id,
          user_id: user.id,
          action: 'state_change',
          state_before: instance.state,
          state_after: newDbState,
          details: { provider_state: providerState, phone_number: phoneNumber },
        });
      }
    }

    return NextResponse.json({
      state: newDbState,
      state_message: stateMessage,
      provider_state: providerState,
      phone_number: phoneNumber,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
    }, { status: 500 });
  }
}
