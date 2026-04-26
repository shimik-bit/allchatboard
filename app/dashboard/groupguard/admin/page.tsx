import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { requireSuperAdmin } from '@/lib/groupguard/super-admin';
import AdminClient from './AdminClient';
import Link from 'next/link';
import { ShieldOff, ArrowRight } from 'lucide-react';

export default async function GroupGuardAdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/auth/login');

  const admin = await requireSuperAdmin(supabase);

  if (!admin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
            <ShieldOff className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">גישה נדחתה</h1>
          <p className="text-sm text-gray-600 mb-6">
            דף זה זמין רק למנהלי AllChatBoard. לא יכולים להציג את המאגר הגלובלי.
          </p>
          <Link
            href="/dashboard/groupguard"
            className="inline-flex items-center gap-2 text-sm text-purple-600 hover:underline"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            חזרה ל-GroupGuard
          </Link>
        </div>
      </div>
    );
  }

  return <AdminClient adminEmail={admin.email} />;
}
