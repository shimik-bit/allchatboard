import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/leads/[id]/convert-to-customer
 *
 * Converts a won/qualified lead into a customer record. This is the third
 * layer of the customer-file initiative — the bridge between the lead
 * pipeline and the customer database.
 *
 * Mechanics:
 *   1. Load the lead and its workspace
 *   2. Find the workspace's customers table (slug='customers')
 *   3. Build the customer's `data` payload by mapping common slugs:
 *      - lead.contact_name OR title  → customer.full_name
 *      - lead.phone                  → customer.phone
 *      - lead.email                  → customer.email
 *      - lead.source                 → customer.source
 *      - lead.value                  → customer.lifetime_value (initial)
 *      - now()                       → customer.joined_at
 *   4. Insert the customer record with conversion_links.originated_from
 *      pointing back to the lead
 *   5. Update the lead's conversion_links.converted_to pointing to the new
 *      customer (NOT the stage — the user already set stage=won, no need
 *      to clobber their pipeline state)
 *   6. Write activity-log entries on both records so the conversion shows
 *      up in both customer files' Timelines
 *
 * Body (all optional):
 *   {
 *     overrides?: { full_name?, phone?, email?, ...other customer slugs }
 *       // Pre-filled values to use instead of pulling from the lead.
 *       // Useful when the user wants to tweak the data before creating.
 *   }
 *
 * Returns: { customer: RecordRow, lead: RecordRow (updated) }
 *
 * Idempotency: if the lead already has conversion_links.converted_to pointing
 * to an existing customer, returns 409 with a hint to use that link. We don't
 * silently return the existing customer because we don't want users to
 * accidentally "convert again" and miss that they're hitting a stale state.
 */

// Common slug aliases — leads tables vary slightly across templates, so we
// check multiple slugs in priority order. Centralized here to keep the
// mapping maintainable.
const LEAD_FIELD_ALIASES = {
  name: ['contact_name', 'full_name', 'name', 'customer_name', 'title'],
  phone: ['phone', 'phone_number', 'mobile'],
  email: ['email', 'email_address'],
  source: ['source'],
  value: ['value', 'opportunity_value', 'amount'],
};

const CUSTOMER_FIELD_ALIASES = {
  full_name: ['full_name', 'name', 'contact_name'],
  phone: ['phone', 'phone_number'],
  email: ['email', 'email_address'],
  source: ['source'],
  lifetime_value: ['lifetime_value', 'value'],
  joined_at: ['joined_at', 'created_at_field'],
};

// Pull the first non-empty value from data for any of the candidate slugs.
function pickValue(data: Record<string, any>, slugs: string[]): any {
  for (const slug of slugs) {
    const v = data?.[slug];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

// Pick the first slug from `candidates` that actually exists in the target
// table's fields (so we don't write to a slug that has no field).
function findExistingSlug(
  candidates: string[],
  fieldSlugs: Set<string>
): string | null {
  for (const c of candidates) if (fieldSlugs.has(c)) return c;
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is fine — overrides are optional
  }
  const overrides = (body && typeof body === 'object' && body.overrides) || {};
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    return NextResponse.json({ error: 'overrides must be an object' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Load the lead with its table info — we need workspace_id + the table slug
  // to confirm this is actually a lead (not a customer or some other record).
  const { data: lead, error: leadError } = await admin
    .from('records')
    .select(
      'id, workspace_id, table_id, data, conversion_links, source, tables!inner(slug)'
    )
    .eq('id', params.id)
    .single();

  if (leadError || !lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }
  if ((lead as any).tables.slug !== 'leads') {
    return NextResponse.json(
      { error: 'this record is not a lead — conversion is only available for leads' },
      { status: 400 }
    );
  }

  // Membership + role check (editor+)
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', lead.workspace_id)
    .eq('user_id', user.id)
    .single();
  if (!membership) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }
  if (!['owner', 'admin', 'editor'].includes(membership.role)) {
    return NextResponse.json(
      { error: 'forbidden — converting requires editor role' },
      { status: 403 }
    );
  }

  // Idempotency: if the lead is already linked to a customer, refuse.
  const existingLink = (lead.conversion_links as any)?.converted_to;
  if (existingLink?.record_id) {
    // Verify the linked customer still exists — if it was deleted, allow re-conversion
    const { data: existingCustomer } = await admin
      .from('records')
      .select('id')
      .eq('id', existingLink.record_id)
      .single();
    if (existingCustomer) {
      return NextResponse.json(
        {
          error: 'lead is already linked to a customer',
          existing_customer_id: existingLink.record_id,
        },
        { status: 409 }
      );
    }
    // Else: dangling link — fall through and create a new one. We'll overwrite
    // the conversion_links entry below.
  }

  // Find the workspace's customers table.
  const { data: customersTable, error: ctErr } = await admin
    .from('tables')
    .select('id, default_assignee_phone_id')
    .eq('workspace_id', lead.workspace_id)
    .eq('slug', 'customers')
    .single();
  if (ctErr || !customersTable) {
    return NextResponse.json(
      {
        error:
          'no customers table in this workspace — create one with slug "customers" first',
      },
      { status: 400 }
    );
  }

  // Load the customers table's field slugs so we only write data to fields
  // that actually exist. Avoids inserting orphan keys that the table can't
  // render.
  const { data: customerFields } = await admin
    .from('fields')
    .select('slug, type, is_required')
    .eq('table_id', customersTable.id);
  const customerSlugs = new Set<string>((customerFields || []).map((f: any) => f.slug as string));

  // Build the customer payload. Start from the lead's data, then apply the
  // user's overrides on top (overrides win — they're the most recent intent).
  const leadData = (lead.data as Record<string, any>) || {};
  const customerData: Record<string, any> = {};

  // Map common slugs from lead to customer, only writing slugs that exist
  // in the customer table.
  const mappings: Array<[keyof typeof CUSTOMER_FIELD_ALIASES, string[]]> = [
    ['full_name', LEAD_FIELD_ALIASES.name],
    ['phone', LEAD_FIELD_ALIASES.phone],
    ['email', LEAD_FIELD_ALIASES.email],
    ['source', LEAD_FIELD_ALIASES.source],
    ['lifetime_value', LEAD_FIELD_ALIASES.value],
  ];

  for (const [customerKey, leadCandidates] of mappings) {
    const customerCandidates = CUSTOMER_FIELD_ALIASES[customerKey];
    const targetSlug = findExistingSlug(customerCandidates, customerSlugs);
    if (!targetSlug) continue; // Customer table has no equivalent field — skip
    const value = pickValue(leadData, leadCandidates);
    if (value !== null) {
      customerData[targetSlug] = value;
    }
  }

  // joined_at: now (only if the customer table has a date field for it)
  const joinedSlug = findExistingSlug(
    CUSTOMER_FIELD_ALIASES.joined_at,
    customerSlugs
  );
  if (joinedSlug) {
    customerData[joinedSlug] = new Date().toISOString().split('T')[0];
  }

  // Apply user overrides (filtered to slugs that exist on the customer table —
  // we silently drop unknown keys rather than 400ing, since the user might
  // pass keys from a different template).
  for (const key of Object.keys(overrides)) {
    if (customerSlugs.has(key)) {
      customerData[key] = overrides[key];
    }
  }

  // Insert the customer record with the conversion link back to the lead
  const { data: customer, error: insertErr } = await admin
    .from('records')
    .insert({
      table_id: customersTable.id,
      workspace_id: lead.workspace_id,
      data: customerData,
      source: 'manual',
      assignee_phone_id: customersTable.default_assignee_phone_id || null,
      conversion_links: {
        originated_from: {
          table_id: lead.table_id,
          record_id: lead.id,
          at: new Date().toISOString(),
        },
      },
    })
    .select('id, table_id, workspace_id, record_number, data, created_at')
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: 'failed to create customer: ' + insertErr.message },
      { status: 500 }
    );
  }

  // Update the lead with the bidirectional link. We preserve any other
  // conversion_links the lead already has (e.g. originated_from for leads
  // that were themselves converted from inbox messages).
  const updatedLeadLinks = {
    ...((lead.conversion_links as object) || {}),
    converted_to: {
      table_id: customersTable.id,
      record_id: customer.id,
      at: new Date().toISOString(),
    },
  };

  const { data: updatedLead, error: updateErr } = await admin
    .from('records')
    .update({
      conversion_links: updatedLeadLinks,
      last_updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .select('id, conversion_links, data, updated_at')
    .single();

  if (updateErr) {
    // The customer was created but we couldn't link the lead. Best-effort
    // rollback: delete the orphan customer so the user can retry cleanly.
    await admin.from('records').delete().eq('id', customer.id);
    return NextResponse.json(
      {
        error: 'failed to link lead to new customer (rolled back): ' + updateErr.message,
      },
      { status: 500 }
    );
  }

  // Activity logs on BOTH records. These show up in each one's Timeline.
  // Service-role inserts because lead_activity_log + record_activity_log
  // both have RLS that doesn't allow user-scoped writes (intentional).
  await admin.from('record_activity_log').insert([
    {
      workspace_id: lead.workspace_id,
      record_id: customer.id,
      actor_id: user.id,
      event_type: 'converted_from_lead',
      summary: `נוצר מליד #${(lead as any).record_number || lead.id.slice(0, 8)}`,
      metadata: { source_lead_id: lead.id },
    },
    {
      workspace_id: lead.workspace_id,
      record_id: lead.id,
      actor_id: user.id,
      event_type: 'converted_to_customer',
      summary: `הומר ללקוח`,
      metadata: { target_customer_id: customer.id },
    },
  ]);

  // Also write to lead_activity_log if the lead has the legacy table
  // (some workspaces use it instead of the generic record_activity_log)
  await admin
    .from('lead_activity_log')
    .insert({
      workspace_id: lead.workspace_id,
      lead_id: lead.id,
      actor_id: user.id,
      event_type: 'converted_to_customer',
      summary: 'הליד הומר ללקוח',
      metadata: { target_customer_id: customer.id },
    })
    .then(() => {}); // Best effort — fail silently if the table is missing

  return NextResponse.json({
    customer,
    lead: updatedLead,
  });
}
