/**
 * /auth/accept-terms
 * ============================================================================
 * Shown after signup or when terms have changed.
 * User must check the box and click accept before accessing the dashboard.
 *
 * Server component: checks auth, checks if user already accepted current version,
 * if so redirects straight to dashboard.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CURRENT_TERMS_VERSION } from '@/lib/terms/version';
import AcceptTermsClient from './AcceptTermsClient';

export const metadata = {
  title: 'אישור תנאי שימוש',
};

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: { redirect?: string };
}) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → send to login
  if (!user) {
    redirect('/auth/login');
  }

  // Check if already accepted current version
  const { data: acceptance } = await supabase
    .from('terms_acceptances')
    .select('id')
    .eq('user_id', user.id)
    .eq('terms_version', CURRENT_TERMS_VERSION)
    .maybeSingle();

  // Already accepted → straight to destination
  if (acceptance) {
    const dest = searchParams.redirect || '/dashboard';
    redirect(dest);
  }

  // Show acceptance UI
  const redirectTo = searchParams.redirect || '/dashboard';
  return (
    <AcceptTermsClient
      userEmail={user.email || ''}
      version={CURRENT_TERMS_VERSION}
      redirectTo={redirectTo}
    />
  );
}
