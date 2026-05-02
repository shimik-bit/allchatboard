// app/dashboard/hub/crm/leads/[id]/page.tsx
// Lead 360 - תצוגה מלאה של ליד עם שיחות, SMS, וואטסאפ + עריכה

import { createAdminClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import LeadDetailClient from './LeadDetailClient';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const admin = createAdminClient();
  
  // שליפת ה-360 של הליד דרך הפונקציה שיצרנו ב-Supabase
  const { data: lead360, error } = await admin.rpc('get_lead_360', { 
    p_lead_id: params.id 
  });

  if (error || !lead360 || lead360.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white rounded-2xl p-8 max-w-md text-center shadow-sm border">
          <div className="text-5xl mb-4">🔍</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">ליד לא נמצא</h2>
          <p className="text-gray-600 mb-6">אולי הוא נמחק או לא קיים</p>
          <Link
            href="/dashboard/hub/crm/kanban"
            className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            חזרה לקנבן
          </Link>
        </div>
      </div>
    );
  }

  return <LeadDetailClient initialData={lead360} />;
}
