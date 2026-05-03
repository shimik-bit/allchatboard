// app/dashboard/hub/crm/leads/[id]/page.tsx
// Lead 360 — comprehensive customer file
//
// IMPORTANT: get_lead_360 is SECURITY DEFINER but it authorizes via auth.uid().
// We MUST use the user-scoped client here (createClient), not createAdminClient.
// The previous version used the admin client, which made auth.uid() null and
// the RPC always returned 'Lead not found'. That's why the page never worked.

import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import LeadDetailClient from './LeadDetailClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'תיק לקוח | TaskFlow' };

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const sb = createClient();

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/auth/login');

  // Calls get_lead_360 as the signed-in user. The RPC verifies workspace
  // membership internally and returns { error: 'Lead not found' } both for
  // missing leads and for forbidden ones — by design (don't leak existence).
  const { data: lead360, error } = await sb.rpc('get_lead_360', {
    p_lead_id: params.id,
  });

  const payload = lead360 as { error?: string; lead?: any } | null;

  if (error || !payload || payload.error || !payload.lead) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-purple-50" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">תיק לקוח לא נמצא</h2>
          <p className="text-gray-600 mb-6">
            ייתכן שהליד נמחק, או שאין לך הרשאה לראות אותו ב-workspace הנוכחי.
          </p>
          <div className="flex gap-2 justify-center">
            <Link
              href="/dashboard/hub/crm/leads"
              className="px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              לרשימת הלידים
            </Link>
            <Link
              href="/dashboard/hub/crm"
              className="px-5 py-2.5 bg-white text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-50 text-sm font-medium"
            >
              לדשבורד CRM
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <LeadDetailClient initialData={payload as any} currentUserId={user.id} />;
}
