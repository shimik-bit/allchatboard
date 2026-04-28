import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/auto-match/run
 *
 * Runs auto-matching for a workspace: tries to link bank transactions
 * to invoices (expenses or income) based on amount + date proximity.
 *
 * Body:
 *   { workspace_id: UUID, days_window?: number (default 3) }
 *
 * Strategy:
 *   For each unmatched bank transaction in the workspace:
 *     1. Find expense invoices with matching amount (negative tx → expense)
 *        within ±days_window days. Score = same-day=1.0, day-off=0.85,
 *        2-days=0.7, 3-days=0.55. Bonus +0.1 if vendor name appears in description.
 *     2. Same for income invoices when tx is positive (zikui).
 *     3. If best match score >= 0.85: auto-confirm and write linked_invoice
 *        field on the transaction record. Else: save as 'suggested' for
 *        user review.
 *
 * Idempotent — running twice won't create duplicate matches (UNIQUE
 * constraint on bank_transaction_record_id+invoice_record_id).
 *
 * Response:
 *   {
 *     transactions_scanned: number,
 *     matches_auto_confirmed: number,
 *     matches_suggested: number,
 *     unmatched: number
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const workspaceId = body.workspace_id;
    const daysWindow = Math.min(Math.max(Number(body.days_window) || 3, 1), 14);

    if (!workspaceId) {
      return NextResponse.json({ error: 'workspace_id required' }, { status: 400 });
    }

    // Verify membership
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

    // Find the bank_transactions, expenses, and income_invoices tables in this workspace
    const { data: workspaceTables } = await admin
      .from('tables')
      .select('id, slug')
      .eq('workspace_id', workspaceId)
      .in('slug', ['bank_transactions', 'expenses', 'income_invoices']);

    const tablesBySlug = new Map<string, string>(
      (workspaceTables || []).map((t: any) => [t.slug, t.id])
    );

    const bankTableId = tablesBySlug.get('bank_transactions');
    const expensesTableId = tablesBySlug.get('expenses');
    const incomeTableId = tablesBySlug.get('income_invoices');

    if (!bankTableId) {
      return NextResponse.json({
        error: 'workspace has no bank_transactions table',
        hint: 'install the bank_transactions template first',
      }, { status: 400 });
    }

    if (!expensesTableId && !incomeTableId) {
      return NextResponse.json({
        transactions_scanned: 0,
        matches_auto_confirmed: 0,
        matches_suggested: 0,
        unmatched: 0,
        note: 'no expense or income invoice tables to match against',
      });
    }

    // Load all bank transactions that aren't already matched
    const { data: bankTxns } = await admin
      .from('records')
      .select('id, data')
      .eq('table_id', bankTableId)
      .or('data->>match_status.is.null,data->>match_status.eq.unmatched');

    if (!bankTxns || bankTxns.length === 0) {
      return NextResponse.json({
        transactions_scanned: 0,
        matches_auto_confirmed: 0,
        matches_suggested: 0,
        unmatched: 0,
      });
    }

    // Load all expense + income invoices for this workspace
    const invoiceTableIds = [expensesTableId, incomeTableId].filter(Boolean) as string[];
    const { data: allInvoices } = await admin
      .from('records')
      .select('id, table_id, data')
      .in('table_id', invoiceTableIds);

    // Index invoices by amount → list of {record, type, date, vendor}
    type InvoiceCandidate = {
      record_id: string;
      type: 'expense' | 'income';
      amount: number;
      date: string;
      vendor: string;
    };
    const invoicesByAmount = new Map<string, InvoiceCandidate[]>();

    for (const inv of allInvoices || []) {
      const isExpense = inv.table_id === expensesTableId;
      const amount = Number(
        inv.data?.amount ?? inv.data?.amount_total
      );
      const date =
        inv.data?.expense_date ?? inv.data?.invoice_date;
      const vendor = String(
        inv.data?.vendor ?? inv.data?.customer_name ?? ''
      ).toLowerCase().trim();

      if (!isFinite(amount) || !date) continue;

      const key = amount.toFixed(2);
      if (!invoicesByAmount.has(key)) invoicesByAmount.set(key, []);
      invoicesByAmount.get(key)!.push({
        record_id: inv.id,
        type: isExpense ? 'expense' : 'income',
        amount,
        date,
        vendor,
      });
    }

    // Process each transaction
    let autoConfirmed = 0;
    let suggested = 0;
    let unmatched = 0;
    const matchInserts: any[] = [];

    for (const tx of bankTxns) {
      const txAmount = Number(tx.data?.amount);
      const txDate = tx.data?.transaction_date;
      const txDescription = String(tx.data?.description || '').toLowerCase();

      if (!isFinite(txAmount) || !txDate) {
        unmatched++;
        continue;
      }

      // For expense matching: bank shows negative (debit), invoice has positive amount
      // For income matching: bank shows positive (credit), invoice has positive amount
      const expectedInvoiceAmount = Math.abs(txAmount);
      const expectedType = txAmount < 0 ? 'expense' : 'income';

      const candidates = invoicesByAmount.get(expectedInvoiceAmount.toFixed(2)) || [];
      const typedCandidates = candidates.filter((c) => c.type === expectedType);

      if (typedCandidates.length === 0) {
        unmatched++;
        continue;
      }

      // Score each candidate
      let bestScore = 0;
      let bestCandidate: InvoiceCandidate | null = null;

      for (const cand of typedCandidates) {
        const dayDiff = Math.abs(daysBetween(txDate, cand.date));
        if (dayDiff > daysWindow) continue;

        // Base score by date proximity
        let score = 1.0 - dayDiff * 0.15;
        if (score < 0.5) continue;

        // Bonus: vendor name appears in transaction description
        if (cand.vendor && txDescription.includes(cand.vendor)) {
          score = Math.min(1.0, score + 0.1);
        }

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = cand;
        }
      }

      if (!bestCandidate) {
        unmatched++;
        continue;
      }

      const status = bestScore >= 0.85 ? 'auto' : 'suggested';
      const matchMethod =
        bestScore >= 0.95
          ? 'exact_amount_date'
          : bestScore >= 0.85
          ? 'amount_close_date'
          : 'ai_suggested';

      matchInserts.push({
        workspace_id: workspaceId,
        bank_transaction_record_id: tx.id,
        invoice_record_id: bestCandidate.record_id,
        invoice_type: bestCandidate.type,
        confidence: bestScore,
        match_method: matchMethod,
        status,
        match_details: {
          tx_amount: txAmount,
          invoice_amount: bestCandidate.amount,
          tx_date: txDate,
          invoice_date: bestCandidate.date,
          score_breakdown: { base: bestScore },
        },
        confirmed_at: status === 'auto' ? new Date().toISOString() : null,
      });

      // For auto-confirmed: also update the bank transaction record's data
      // (so it shows up in the UI immediately as linked)
      if (status === 'auto') {
        await admin
          .from('records')
          .update({
            data: {
              ...tx.data,
              linked_invoice: bestCandidate.record_id,
              match_status: 'auto_matched',
            },
          })
          .eq('id', tx.id);
        autoConfirmed++;
      } else {
        suggested++;
      }
    }

    // Bulk insert match records (ignore conflicts - idempotency)
    if (matchInserts.length > 0) {
      await admin
        .from('record_matches')
        .upsert(matchInserts, {
          onConflict: 'bank_transaction_record_id,invoice_record_id',
          ignoreDuplicates: true,
        });
    }

    return NextResponse.json({
      transactions_scanned: bankTxns.length,
      matches_auto_confirmed: autoConfirmed,
      matches_suggested: suggested,
      unmatched,
    });
  } catch (e: any) {
    console.error('Auto-match error', e);
    return NextResponse.json(
      { error: e?.message || 'failed to run matcher' },
      { status: 500 }
    );
  }
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}
