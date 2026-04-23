'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LayoutGrid, Loader2 } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/onboarding');
      router.refresh();
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-br from-brand-50 to-white px-4 py-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 grid place-items-center">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl">AllChatBoard</span>
        </Link>

        <div className="card p-8">
          <h1 className="font-display font-bold text-2xl mb-1">פתחו חשבון חינם</h1>
          <p className="text-gray-500 text-sm mb-6">14 יום ניסיון, ללא כרטיס אשראי</p>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">שם מלא</label>
              <input
                type="text" required
                value={name} onChange={(e) => setName(e.target.value)}
                className="input-field" placeholder="ישראל ישראלי"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">אימייל</label>
              <input
                type="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="input-field" placeholder="you@example.com" dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">סיסמה</label>
              <input
                type="password" required minLength={6}
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="input-field" dir="ltr"
              />
              <p className="text-xs text-gray-500 mt-1">לפחות 6 תווים</p>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'הרשמה והתחלת ניסיון'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            כבר יש לכם חשבון?{' '}
            <Link href="/auth/login" className="text-brand-600 font-medium hover:underline">
              התחברו כאן
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
