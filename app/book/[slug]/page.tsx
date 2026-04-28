import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import BookingPageClient from './BookingPageClient';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Generate the page title from the booking page
export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: page } = await admin
    .from('booking_pages')
    .select('title, description')
    .eq('slug', params.slug)
    .eq('enabled', true)
    .maybeSingle();

  if (!page) return { title: 'הזמנת פגישה' };
  return {
    title: `${page.title} · קביעת פגישה`,
    description: page.description || `קבע פגישה: ${page.title}`,
  };
}

export default async function BookPage({ params }: { params: { slug: string } }) {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: page } = await admin
    .from('booking_pages')
    .select('slug, title, description, duration_minutes, form_fields, confirmation_message, working_hours')
    .eq('slug', params.slug)
    .eq('enabled', true)
    .maybeSingle();

  if (!page) notFound();

  return <BookingPageClient page={page} />;
}
