import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import FocusClient from './FocusClient';

export const dynamic = 'force-dynamic';

export default async function FocusPage() {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    redirect('/auth/login?next=/dashboard/focus');
  }

  // Get user's workspaces
  const { data: memberships, error: memError } = await supabase
    .from('workspace_members')
    .select('workspace_id, role, workspaces(id, name, icon)')
    .eq('user_id', user.id);

  if (memError) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-3">⚠️</div>
          <h1 className="font-display font-bold text-xl mb-2">שגיאה בטעינת המידע</h1>
          <p className="text-sm text-gray-600 mb-4">
            לא הצלחנו לטעון את הסביבות שלך. ייתכן שיש בעיית חיבור.
          </p>
          <code className="block text-[10px] bg-gray-100 p-2 rounded text-left text-red-700 mb-4">
            {memError.message}
          </code>
          <Link href="/dashboard" className="text-purple-600 text-sm">חזרה לדשבורד</Link>
        </div>
      </div>
    );
  }

  if (!memberships || memberships.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="font-display font-bold text-xl mb-2">אין סביבות עבודה</h1>
          <p className="text-sm text-gray-600 mb-4">
            כדי להשתמש ב-Focus Mode צריך לפחות סביבת עבודה אחת.
          </p>
          <Link 
            href="/onboarding" 
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
          >
            יצירת סביבה ראשונה
          </Link>
        </div>
      </div>
    );
  }

  // Get current role for first workspace
  const firstWorkspaceId = (memberships[0] as any).workspace_id;
  const { data: role } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', user.id)
    .eq('workspace_id', firstWorkspaceId)
    .maybeSingle();

  return (
    <FocusClient
      userId={user.id}
      memberships={memberships as any}
      initialWorkspaceId={firstWorkspaceId}
      currentRole={role}
    />
  );
}
