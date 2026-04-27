import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import InviteAcceptClient from './InviteAcceptClient';

export const dynamic = 'force-dynamic';

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  
  // Get invitation - using anon role since user may not be logged in
  const { data: invitation } = await supabase
    .from('workspace_invitations')
    .select('id, workspace_id, email, role, display_name, message, status, expires_at, workspaces(name, icon)')
    .eq('token', params.token)
    .maybeSingle();

  // Check if logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
          <div className="text-5xl mb-3">😕</div>
          <h1 className="font-display font-bold text-2xl mb-2">הזמנה לא תקפה</h1>
          <p className="text-sm text-gray-600 mb-4">
            הקישור שגוי או שההזמנה כבר אינה פעילה.
          </p>
          <Link href="/" className="text-purple-600 text-sm font-medium">חזרה לדף הבית</Link>
        </div>
      </div>
    );
  }

  if (invitation.status !== 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
          <div className="text-5xl mb-3">⚠️</div>
          <h1 className="font-display font-bold text-2xl mb-2">
            {invitation.status === 'accepted' ? 'ההזמנה כבר אושרה' : 
             invitation.status === 'expired' ? 'ההזמנה פגה' : 
             'ההזמנה בוטלה'}
          </h1>
          <Link href="/dashboard" className="text-purple-600 text-sm font-medium">לדשבורד</Link>
        </div>
      </div>
    );
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
          <div className="text-5xl mb-3">⏰</div>
          <h1 className="font-display font-bold text-2xl mb-2">ההזמנה פגה</h1>
          <p className="text-sm text-gray-600 mb-4">
            הזמנות בתוקף 14 יום בלבד. בקש מהמזמין לשלוח חדשה.
          </p>
        </div>
      </div>
    );
  }

  const workspace: any = Array.isArray(invitation.workspaces) ? invitation.workspaces[0] : invitation.workspaces;
  const roleLabels: Record<string, string> = {
    owner: 'בעלים',
    admin: 'מנהל',
    editor: 'עורך',
    viewer: 'צופה',
  };

  return (
    <InviteAcceptClient
      invitation={{
        id: invitation.id,
        workspace_id: invitation.workspace_id,
        workspace_name: workspace?.name || '?',
        workspace_icon: workspace?.icon,
        email: invitation.email,
        role: invitation.role,
        role_label: roleLabels[invitation.role] || invitation.role,
        message: invitation.message,
      }}
      token={params.token}
      currentUserEmail={user?.email}
    />
  );
}
