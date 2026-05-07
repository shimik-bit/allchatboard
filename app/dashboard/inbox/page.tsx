/**
 * /dashboard/inbox - Escalation Queue
 *
 * Two-pane layout (the WhatsApp-Web-like view, but for escalations only):
 *   - Left: list of escalations, prioritized urgent-first then by recency
 *   - Right: selected thread with messages + reply box
 *
 * Server component handles initial data load + selected escalation routing
 * via ?id=... search param. Client component handles interactivity (filter,
 * reply, status updates).
 *
 * Why server-rendered initial: the inbox is the first thing a user touches
 * after login, so it should feel snappy. Loading the list and selected
 * thread server-side avoids the spinner-on-spinner cascade.
 */
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import InboxClient from './InboxClient';

export const dynamic = 'force-dynamic';

interface SearchParams {
  id?: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'dismissed' | 'all';
  channel?: 'whatsapp' | 'telegram' | 'all';
}

export default async function InboxPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const activeWsId = cookies().get('tf_active_workspace')?.value;
  if (!activeWsId) redirect('/dashboard');

  // Load all escalations for the active workspace, with the prioritization
  // we want in the queue: urgent first, then by recency. RLS handles the
  // workspace gate so we don't need to specify workspace_id explicitly,
  // but adding it explicitly enables the index `idx_escalations_workspace_status`.
  const statusFilter = searchParams.status || 'open';
  const channelFilter = searchParams.channel || 'all';
  let query = supabase
    .from('escalations')
    .select('*')
    .eq('workspace_id', activeWsId);

  if (statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }
  if (channelFilter !== 'all') {
    query = query.eq('channel', channelFilter);
  }

  // Ordering: urgent first, then recent. We can't directly order by enum
  // value priority desc (it'd alphabetize: low/normal/urgent which is wrong).
  // Workaround: order by a CASE in raw SQL — Supabase JS doesn't support
  // arbitrary SQL in order(), so we sort in JS instead. The list is small
  // (<200 escalations realistically) so it's fine.
  const { data: rawEscalations } = await query.order('created_at', { ascending: false });

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, normal: 1, low: 2 };
  const escalations = (rawEscalations || []).sort((a: any, b: any) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // If a specific escalation is selected via URL, load its message thread
  // server-side so the right pane renders immediately (no fetch waterfall).
  // We pull the messages by sender_phone match because that's the
  // conversation key — wa_messages doesn't have a chat_id column today.
  let selectedEscalation: any = null;
  let messages: any[] = [];
  if (searchParams.id) {
    const sel = escalations.find((e: any) => e.id === searchParams.id);
    if (sel) {
      selectedEscalation = sel;
      // Load the message thread from the unified_messages view. The conversation
      // key (sender_key) is the phone number for WhatsApp escalations and the
      // telegram_chat_id (uuid as text) for Telegram escalations. Both are
      // backed by RLS on the underlying tables.
      const channel = (sel.channel as 'whatsapp' | 'telegram') || 'whatsapp';
      const senderKey =
        channel === 'telegram' ? sel.source_telegram_chat_id : sel.source_phone;
      if (senderKey) {
        const { data: msgs } = await supabase
          .from('unified_messages')
          .select('id, channel, text, direction, sender_key, sender_display_name, received_at, status, media_url, media_kind')
          .eq('workspace_id', activeWsId)
          .eq('channel', channel)
          .eq('sender_key', senderKey)
          .order('received_at', { ascending: true })
          .limit(100);
        messages = msgs || [];
      }
    }
  }

  // Counts for the filter tabs (open/in_progress/resolved). One round-trip
  // per status is fine — these are head-only count queries (cheap).
  // The counts are scoped to the currently selected channel so the badge
  // numbers match what the user actually sees in the list.
  const countQ = (status: string) => {
    let q = supabase.from('escalations').select('id', { count: 'exact', head: true })
      .eq('workspace_id', activeWsId).eq('status', status);
    if (channelFilter !== 'all') q = q.eq('channel', channelFilter);
    return q;
  };
  const [openCnt, inProgressCnt, resolvedCnt] = await Promise.all([
    countQ('open'),
    countQ('in_progress'),
    countQ('resolved'),
  ]);

  return (
    <InboxClient
      escalations={escalations}
      selected={selectedEscalation}
      messages={messages}
      currentStatus={statusFilter}
      currentChannel={channelFilter}
      counts={{
        open: openCnt.count || 0,
        in_progress: inProgressCnt.count || 0,
        resolved: resolvedCnt.count || 0,
      }}
      currentUserId={user.id}
    />
  );
}
