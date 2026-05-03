import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import RecordDetailClient from './RecordDetailClient';
import Link from 'next/link';

/**
 * /dashboard/[tableId]/records/[recordId]
 *
 * Generic "record file" (תיק לקוח) — works for any record in any table.
 * Loads data via the get_record_360 RPC, which:
 *  - verifies the caller is a member of the record's workspace
 *  - returns null/error if not (no info leak)
 *
 * The RPC is SECURITY DEFINER but requires auth.uid() to resolve, so we MUST
 * use the user-scoped client here (NOT the admin client). The lead 360 page
 * had this exact bug for weeks — we caught it during the customer-file rewrite.
 */
export default async function RecordDetailPage({
  params,
}: {
  params: { tableId: string; recordId: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  // Pull the record via the 360 RPC — single round-trip, includes everything.
  const { data: payload, error } = await supabase.rpc('get_record_360', {
    p_record_id: params.recordId,
  });

  // Helpful empty-state for any failure (not found, no membership, etc.).
  // We don't differentiate the cases on the UI — that would leak existence.
  if (error || !payload || (payload as any).error) {
    return (
      <div dir="rtl" className="max-w-2xl mx-auto p-6 mt-12 text-center">
        <div className="text-6xl mb-4">🤷‍♂️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">הרשומה לא נמצאה</h1>
        <p className="text-gray-600 mb-6">
          ייתכן שהרשומה נמחקה, אינה קיימת, או שאין לך הרשאות גישה אליה.
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href={`/dashboard/${params.tableId}`}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            חזרה לטבלה
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            לדשבורד
          </Link>
        </div>
      </div>
    );
  }

  // Pull the table's fields so the client can render the values with their
  // types/labels. The RPC already gave us r.data, but we still need field
  // metadata (name, type, position, config) for nice rendering.
  const { data: fields } = await supabase
    .from('fields')
    .select('*')
    .eq('table_id', params.tableId)
    .order('position');

  return (
    <RecordDetailClient
      tableId={params.tableId}
      initialData={payload as any}
      fields={fields || []}
      currentUserId={user.id}
    />
  );
}
