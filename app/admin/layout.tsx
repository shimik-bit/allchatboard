import { requirePlatformAdmin } from '@/lib/admin/auth';
import AdminShell from './AdminShell';

export const metadata = {
  title: 'Platform Admin · TaskFlow AI',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin, user } = await requirePlatformAdmin();

  return (
    <AdminShell admin={admin} userEmail={user.email}>
      {children}
    </AdminShell>
  );
}
