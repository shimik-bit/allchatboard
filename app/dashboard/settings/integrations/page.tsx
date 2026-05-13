import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import IntegrationsClient from './IntegrationsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'אינטגרציות - TaskFlow AI',
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: { google?: string; reason?: string; email?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Banner flag from the OAuth callback
  const flash = searchParams.google
    ? {
        kind: searchParams.google as 'connected' | 'error',
        reason: searchParams.reason ?? null,
        email: searchParams.email ?? null,
      }
    : null;

  return <IntegrationsClient flash={flash} />;
}
