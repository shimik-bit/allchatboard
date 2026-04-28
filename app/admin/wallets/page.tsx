import { adminServiceClient, requirePlatformAdmin } from '@/lib/admin/auth';
import Link from 'next/link';
import { ChevronLeft, Wallet } from 'lucide-react';
import WalletsAdminClient from './WalletsAdminClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminWalletsPage() {
  await requirePlatformAdmin();
  const supabase = adminServiceClient();

  const { data: wallets } = await supabase
    .from('wallet_status').select('*').order('balance_usd', { ascending: false });

  const { data: settings } = await supabase
    .from('ai_pricing_settings').select('*').eq('id', 1).single();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        <Link href="/admin" className="text-xs text-slate-500 hover:text-amber-500 inline-flex items-center gap-1 mb-2">
          <ChevronLeft className="w-3 h-3" /> חזרה ל-Admin
        </Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-amber-500" />
            ניהול ארנקים AI
          </h1>
          <Link href="/admin/ai-pricing" className="text-xs text-amber-500 hover:text-amber-400">
            ⚙ הגדרות תמחור גלובליות
          </Link>
        </div>

        <WalletsAdminClient wallets={wallets || []} defaultMarkup={settings?.default_markup_multiplier || 5} />
      </div>
    </div>
  );
}
