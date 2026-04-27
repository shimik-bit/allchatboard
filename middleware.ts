import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { CURRENT_TERMS_VERSION } from '@/lib/terms/version';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string; options?: any }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith('/auth');
  const isAcceptTermsRoute = pathname.startsWith('/auth/accept-terms');
  const isCallbackRoute = pathname.includes('callback');
  const isProtectedRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding');

  // 1. Not logged in + protected route → login
  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // 2. Logged in + protected route → check terms acceptance
  if (user && isProtectedRoute) {
    const { data: acceptance } = await supabase
      .from('terms_acceptances')
      .select('id')
      .eq('user_id', user.id)
      .eq('terms_version', CURRENT_TERMS_VERSION)
      .maybeSingle();

    if (!acceptance) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/accept-terms';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
  }

  // 3. Logged in + on /auth/* (not callback, not accept-terms) → dashboard
  if (user && isAuthRoute && !isCallbackRoute && !isAcceptTermsRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
