// Prevent static prerendering - this page uses Supabase client which needs
// runtime env vars. Without this, build fails on Vercel preview deployments
// that don't have NEXT_PUBLIC_SUPABASE_URL available during build.
export const dynamic = 'force-dynamic';

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
