'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2 } from 'lucide-react';
import { useT } from '@/lib/i18n/useT';

export default function LoginPage() {
  const { t } = useT();
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 to-white px-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center mb-8">
          <img
            src="/taskflow-logo.png"
            alt="TaskFlow AI"
            className="h-24 w-auto object-contain"
          />
        </Link>

        <div className="card p-8">
          <h1 className="font-display font-bold text-2xl mb-1">{t('auth.welcome_back') || 'ברוכים השבים'}</h1>
          <p className="text-gray-500 text-sm mb-6">{t('auth.sign_in_to_account') || 'התחברו לחשבון שלכם'}</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('auth.email') || 'אימייל'}</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('auth.password') || 'סיסמה'}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                dir="ltr"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (t('auth.login') || 'התחברות')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            {t('auth.no_account') || 'אין לכם חשבון?'}{' '}
            <Link href="/auth/signup" className="text-brand-600 font-medium hover:underline">
              {t('auth.sign_up_now') || 'הרשמו עכשיו'}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
