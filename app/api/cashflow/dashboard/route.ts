import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cashflow/dashboard?workspace_id=...
 *
 * Aggregates the cashflow_forecast table into the shape needed by the
 * dashboard view: daily buckets + KPIs + a list of low-confidence items
 * the user should review.
 *
 * Response:
 *   {
 *     starting_balance: number,        // estimated current balance from bank txns
 *     daily_buckets: [
 *       { date, income, expense, net, running_balance, items_count }
 *     ],
 *     kpis: {
 *       total_income_forecast: number,
 *       total_expense_forecast: number,
 *       net_forecast: number,
 *       lowest_balance_day: { date, balance } | null,
 *       confirmation_pending: number,  // count of forecast entries needing user action
 *     },
 *     items_to_review: [...]           // top low-confidence entries
 *   }
 */
export async function GET(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const workspaceId = req.nextUrl.searchParams.get('workspace_id');
    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Find the cashflow_forecast table
    const { data: cashflowTable } = await admin
      .from('tables')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('slug', 'cashflow_forecast')
      .single();

    if (!cashflowTable) {
      return NextResponse.json({
        not_installed: true,
        message: 'Cashflow template not installed in this workspace',
      });
    }

    // Estimate starting balance from latest bank transaction's balance_after,
    // or 0 if not available. This isn't perfect — best-effort only.
    const startingBalance = await estimateStartingBalance(admin, workspaceId);

    // Load all forecast entries (today and forward)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString().slice(0, 10);

    const { data: forecasts } = await admin
      .from('records')
      .select('id, data')
      .eq('table_id', cashflowTable.id)
      .gte('data->>expected_date', todayIso)
      .order('data->>expected_date', { ascending: true });

    if (!forecasts || forecasts.length === 0) {
      return NextResponse.json({
        starting_balance: startingBalance,
        daily_buckets: [],
        kpis: {
          total_income_forecast: 0,
          total_expense_forecast: 0,
          net_forecast: 0,
          lowest_balance_day: null,
          confirmation_pending: 0,
        },
        items_to_review: [],
      });
    }

    // Build daily buckets
    type Bucket = {
      date: string;
      income: number;
      expense: number;
      net: number;
      running_balance: number;
      items_count: number;
    };
    const bucketsByDate = new Map<string, Bucket>();

    let totalIncome = 0;
    let totalExpense = 0;
    let pendingConfirmation = 0;
    const itemsToReview: any[] = [];

    for (const f of forecasts) {
      const d = f.data;
      if (!d?.expected_date) continue;
      const date = String(d.expected_date).slice(0, 10);
      const amount = Number(d.amount) || 0;
      const status = d.status || 'forecast';
      const confidence = Number(d.confidence) || 0;

      // Skip items the user marked as skipped
      if (status === 'skipped') continue;

      let bucket = bucketsByDate.get(date);
      if (!bucket) {
        bucket = { date, income: 0, expense: 0, net: 0, running_balance: 0, items_count: 0 };
        bucketsByDate.set(date, bucket);
      }
      // Weight uncertain items by confidence/100
      const weight = status === 'forecast' ? confidence / 100 : 1.0;
      const weightedAmount = amount * weight;

      if (amount > 0) {
        bucket.income += weightedAmount;
        totalIncome += weightedAmount;
      } else {
        bucket.expense += weightedAmount; // negative
        totalExpense += weightedAmount;
      }
      bucket.net = bucket.income + bucket.expense;
      bucket.items_count++;

      if (status === 'forecast') {
        pendingConfirmation++;
        // Surface low-confidence items for review (top 10)
        if (confidence < 80 && itemsToReview.length < 15) {
          itemsToReview.push({
            id: f.id,
            date,
            description: d.description,
            amount,
            confidence,
            kind: d.kind,
            source: d.source,
          });
        }
      }
    }

    // Sort buckets by date and compute running balance
    const sortedBuckets: Bucket[] = Array.from(bucketsByDate.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    let runningBalance = startingBalance;
    let lowestBalance: { date: string; balance: number } | null = null;
    for (const b of sortedBuckets) {
      runningBalance += b.net;
      b.running_balance = Math.round(runningBalance);
      if (lowestBalance === null || runningBalance < lowestBalance.balance) {
        lowestBalance = { date: b.date, balance: Math.round(runningBalance) };
      }
    }

    // Sort review items by confidence (lowest first - those need most attention)
    itemsToReview.sort((a, b) => a.confidence - b.confidence);

    return NextResponse.json({
      starting_balance: Math.round(startingBalance),
      daily_buckets: sortedBuckets,
      kpis: {
        total_income_forecast: Math.round(totalIncome),
        total_expense_forecast: Math.round(totalExpense),
        net_forecast: Math.round(totalIncome + totalExpense),
        lowest_balance_day: lowestBalance,
        confirmation_pending: pendingConfirmation,
      },
      items_to_review: itemsToReview,
    });
  } catch (e: any) {
    console.error('Cashflow dashboard error', e);
    return NextResponse.json(
      { error: e?.message || 'failed to load dashboard' },
      { status: 500 }
    );
  }
}

/**
 * Best-effort estimate of current balance from the latest bank transaction
 * that has a `balance_after` value. Falls back to 0 if not available.
 */
async function estimateStartingBalance(admin: any, workspaceId: string): Promise<number> {
  const { data: bankTable } = await admin
    .from('tables')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('slug', 'bank_transactions')
    .single();

  if (!bankTable) return 0;

  const { data: latestTxn } = await admin
    .from('records')
    .select('data')
    .eq('table_id', bankTable.id)
    .not('data->>balance_after', 'is', null)
    .order('data->>transaction_date', { ascending: false })
    .limit(1)
    .single();

  return Number(latestTxn?.data?.balance_after) || 0;
}
