/**
 * Cashflow Forecast Engine
 *
 * Generates forward-looking cashflow entries from 4 sources:
 *   1. Recurring patterns detected from historical bank transactions
 *   2. Pending invoices (expense + income) with future expected payment dates
 *   3. VAT obligations (15th of each month for prior period)
 *   4. Sales pipeline (CRM records with expected_value + probability)
 *
 * Output: rows in the user's `cashflow_forecast` table with confidence scores
 * the user can then confirm/skip.
 *
 * Idempotency: each run computes a stable signature per forecast row
 * (kind|date|description|amount). On re-run, existing rows with the same
 * signature are updated rather than duplicated. Forecasts the user has
 * marked 'confirmed' or 'actual' are never overwritten.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// VAT rate in Israel (changes occasionally - last update was 18% in Jan 2025)
const VAT_RATE = 0.18;

// Minimum occurrences to consider a transaction "recurring"
const MIN_OCCURRENCES_FOR_RECURRING = 3;

// How far back we look for pattern detection
const HISTORICAL_LOOKBACK_DAYS = 180;

// Default forecast horizon if no plan limit found (covers free tier)
const DEFAULT_HORIZON_DAYS = 30;

export interface CashflowGenerateResult {
  forecasts_created: number;
  forecasts_updated: number;
  forecasts_unchanged: number;
  recurring_patterns_detected: number;
  vat_obligations_calculated: number;
  pending_invoices_added: number;
  pipeline_records_added: number;
  bank_transactions_analyzed: number;
  horizon_days: number;
}

interface RecurringPattern {
  signature: string;        // canonical key for matching: vendor + amount range
  description: string;      // human label
  amount: number;           // typical amount (median)
  day_of_month: number;     // 1-31
  occurrences: number;      // how many times observed
  last_seen: string;        // ISO date of most recent occurrence
  first_seen: string;       // ISO date of earliest occurrence
  confidence: number;       // 0-100
  category: string | null;
}

/**
 * Main entry point - generates forecast for a workspace.
 */
export async function generateCashflowForecast(
  admin: SupabaseClient,
  workspaceId: string,
  triggeredBy: 'manual' | 'auto_after_import' | 'cron' = 'manual',
  triggeredByUser?: string
): Promise<CashflowGenerateResult> {
  const startTime = Date.now();

  // Create run record
  const { data: runRecord } = await admin
    .from('cashflow_runs')
    .insert({
      workspace_id: workspaceId,
      status: 'running',
      triggered_by: triggeredBy,
      triggered_by_user: triggeredByUser || null,
    })
    .select('id')
    .single();
  const runId = runRecord?.id;

  try {
    // 1. Determine forecast horizon based on workspace's plan
    const horizonDays = await getForecastHorizonDays(admin, workspaceId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizonDate = new Date(today.getTime() + horizonDays * 86400000);

    // 2. Find the cashflow_forecast table - bail if not installed
    const { data: cashflowTable } = await admin
      .from('tables')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('slug', 'cashflow_forecast')
      .single();

    if (!cashflowTable) {
      throw new Error('cashflow_forecast table not installed in workspace');
    }
    const forecastTableId = cashflowTable.id;

    // 3. Locate the related financial tables (may not all exist)
    const { data: relatedTables } = await admin
      .from('tables')
      .select('id, slug')
      .eq('workspace_id', workspaceId)
      .in('slug', ['bank_transactions', 'expenses', 'income_invoices']);

    const tablesBySlug = new Map<string, string>(
      (relatedTables || []).map((t: any) => [t.slug, t.id])
    );

    // 4. Load existing forecasts so we can dedupe (and preserve user-confirmed entries)
    const { data: existingForecasts } = await admin
      .from('records')
      .select('id, data')
      .eq('table_id', forecastTableId)
      .gte('data->>expected_date', isoDate(today));

    const existingBySignature = new Map<string, any>();
    const protectedIds = new Set<string>(); // user-confirmed = don't overwrite
    for (const rec of existingForecasts || []) {
      const sig = forecastSignature(rec.data);
      if (sig) existingBySignature.set(sig, rec);
      if (rec.data?.status === 'confirmed' || rec.data?.status === 'actual') {
        protectedIds.add(rec.id);
      }
    }

    // 5. Build all the forecast entries
    const allForecasts: any[] = [];
    const counters = {
      bank_transactions_analyzed: 0,
      recurring_patterns_detected: 0,
      vat_obligations_calculated: 0,
      pending_invoices_added: 0,
      pipeline_records_added: 0,
    };

    // ===== Source 1: Recurring patterns from bank transactions =====
    const bankTableId = tablesBySlug.get('bank_transactions');
    if (bankTableId) {
      const patterns = await detectRecurringPatterns(admin, bankTableId);
      counters.bank_transactions_analyzed = patterns.bankTxnCount;
      counters.recurring_patterns_detected = patterns.patterns.length;

      for (const pattern of patterns.patterns) {
        const projected = projectRecurringIntoFuture(pattern, today, horizonDate);
        allForecasts.push(...projected);
      }
    }

    // ===== Source 2: Pending invoices =====
    const expenseTableId = tablesBySlug.get('expenses');
    const incomeTableId = tablesBySlug.get('income_invoices');
    const invoiceTableIds = [expenseTableId, incomeTableId].filter(Boolean) as string[];

    if (invoiceTableIds.length > 0) {
      const pendingForecasts = await loadPendingInvoiceForecasts(
        admin,
        invoiceTableIds,
        expenseTableId || null,
        today,
        horizonDate
      );
      counters.pending_invoices_added = pendingForecasts.length;
      allForecasts.push(...pendingForecasts);
    }

    // ===== Source 3: VAT obligations =====
    if (expenseTableId || incomeTableId) {
      const vatForecasts = await calculateVatObligations(
        admin,
        expenseTableId || null,
        incomeTableId || null,
        today,
        horizonDate
      );
      counters.vat_obligations_calculated = vatForecasts.length;
      allForecasts.push(...vatForecasts);
    }

    // ===== Source 4: Pipeline (CRM records with expected_value) =====
    const pipelineForecasts = await loadPipelineForecasts(
      admin,
      workspaceId,
      forecastTableId,
      today,
      horizonDate
    );
    counters.pipeline_records_added = pipelineForecasts.length;
    allForecasts.push(...pipelineForecasts);

    // 6. Apply: insert new + update existing (skip protected)
    let created = 0;
    let updated = 0;
    let unchanged = 0;

    const recordsToInsert: any[] = [];
    const updates: { id: string; data: any }[] = [];

    for (const forecast of allForecasts) {
      const sig = forecastSignature(forecast);
      if (!sig) continue;

      const existing = existingBySignature.get(sig);
      if (existing) {
        // Don't touch user-confirmed entries
        if (protectedIds.has(existing.id)) {
          unchanged++;
          continue;
        }
        // Compare key fields - update only if changed
        const changed =
          Number(existing.data?.amount) !== Number(forecast.amount) ||
          Number(existing.data?.confidence) !== Number(forecast.confidence) ||
          existing.data?.expected_date !== forecast.expected_date;

        if (changed) {
          updates.push({
            id: existing.id,
            data: { ...existing.data, ...forecast },
          });
          updated++;
        } else {
          unchanged++;
        }
      } else {
        recordsToInsert.push({
          table_id: forecastTableId,
          workspace_id: workspaceId,
          data: forecast,
          source: 'api',
        });
        created++;
      }
    }

    // Bulk inserts
    if (recordsToInsert.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
        await admin.from('records').insert(recordsToInsert.slice(i, i + chunkSize));
      }
    }

    // Updates one-by-one (typically very few)
    for (const u of updates) {
      await admin.from('records').update({ data: u.data }).eq('id', u.id);
    }

    // 7. Mark the run as completed
    if (runId) {
      await admin
        .from('cashflow_runs')
        .update({
          status: 'completed',
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
          forecasts_created: created,
          forecasts_updated: updated,
          ...counters,
        })
        .eq('id', runId);
    }

    return {
      forecasts_created: created,
      forecasts_updated: updated,
      forecasts_unchanged: unchanged,
      horizon_days: horizonDays,
      ...counters,
    };
  } catch (e: any) {
    if (runId) {
      await admin
        .from('cashflow_runs')
        .update({
          status: 'failed',
          duration_ms: Date.now() - startTime,
          completed_at: new Date().toISOString(),
          error_message: String(e?.message || e).slice(0, 500),
        })
        .eq('id', runId);
    }
    throw e;
  }
}

// ============================================================================
// Source 1: Recurring pattern detection
// ============================================================================

async function detectRecurringPatterns(
  admin: SupabaseClient,
  bankTableId: string
): Promise<{ patterns: RecurringPattern[]; bankTxnCount: number }> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - HISTORICAL_LOOKBACK_DAYS);

  const { data: txns } = await admin
    .from('records')
    .select('id, data')
    .eq('table_id', bankTableId)
    .gte('data->>transaction_date', isoDate(lookbackDate))
    .order('data->>transaction_date', { ascending: true });

  if (!txns || txns.length === 0) {
    return { patterns: [], bankTxnCount: 0 };
  }

  // Group transactions by canonical signature (vendor description normalized)
  const groups = new Map<string, any[]>();
  for (const tx of txns) {
    const desc = String(tx.data?.description || '').trim();
    const amount = Number(tx.data?.amount);
    const date = tx.data?.transaction_date;
    if (!desc || !isFinite(amount) || !date) continue;

    // Normalize: remove dates, ref numbers, common volatile bits
    const sig = canonicalDescription(desc) + '|' + roundAmount(amount);
    if (!groups.has(sig)) groups.set(sig, []);
    groups.get(sig)!.push({ desc, amount, date });
  }

  // Filter to actual recurring patterns
  const patterns: RecurringPattern[] = [];
  for (const [sig, occurrences] of groups.entries()) {
    if (occurrences.length < MIN_OCCURRENCES_FOR_RECURRING) continue;

    // Sort by date
    occurrences.sort((a, b) => a.date.localeCompare(b.date));

    // Compute typical day-of-month (median)
    const days = occurrences.map((o) => new Date(o.date).getDate()).sort((a, b) => a - b);
    const dayOfMonth = days[Math.floor(days.length / 2)];

    // Compute median amount
    const amounts = occurrences.map((o) => o.amount).sort((a, b) => a - b);
    const medianAmount = amounts[Math.floor(amounts.length / 2)];

    // Confidence = base on occurrence count + day consistency
    const dayVariance = Math.max(...days) - Math.min(...days);
    const dayConsistency = Math.max(0, 1 - dayVariance / 10); // 0 variance = 1.0
    const occurrenceScore = Math.min(1, occurrences.length / 6); // 6+ occurrences = 1.0
    const confidence = Math.round((dayConsistency * 0.6 + occurrenceScore * 0.4) * 100);

    if (confidence < 50) continue; // Drop unreliable patterns

    patterns.push({
      signature: sig,
      description: occurrences[0].desc, // use first observed description
      amount: medianAmount,
      day_of_month: dayOfMonth,
      occurrences: occurrences.length,
      first_seen: occurrences[0].date,
      last_seen: occurrences[occurrences.length - 1].date,
      confidence,
      category: guessCategory(occurrences[0].desc, medianAmount),
    });
  }

  return { patterns, bankTxnCount: txns.length };
}

function canonicalDescription(desc: string): string {
  return desc
    .toLowerCase()
    .replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '') // remove dates
    .replace(/\b\d{6,}\b/g, '') // remove long numbers (ref ids)
    .replace(/\s+/g, ' ')
    .trim();
}

function roundAmount(amount: number): string {
  // Round to 1% — same vendor sometimes varies by ±1₪
  const abs = Math.abs(amount);
  const rounded = Math.round(abs / Math.max(1, abs * 0.01)) * Math.max(1, abs * 0.01);
  return (Math.sign(amount) * rounded).toFixed(0);
}

/**
 * Project a recurring pattern into the future, respecting the horizon.
 */
function projectRecurringIntoFuture(
  pattern: RecurringPattern,
  today: Date,
  horizon: Date
): any[] {
  const out: any[] = [];
  const isExpense = pattern.amount < 0;

  // Start from current month
  const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endMonth = new Date(horizon.getFullYear(), horizon.getMonth() + 1, 1);

  for (
    let cursor = new Date(startMonth);
    cursor < endMonth;
    cursor.setMonth(cursor.getMonth() + 1)
  ) {
    // Pick the typical day in that month (clamp to month length)
    const lastDayOfMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const day = Math.min(pattern.day_of_month, lastDayOfMonth);
    const expectedDate = new Date(cursor.getFullYear(), cursor.getMonth(), day);

    if (expectedDate < today) continue; // skip dates already in the past
    if (expectedDate > horizon) break;

    out.push({
      expected_date: isoDate(expectedDate),
      description: pattern.description,
      amount: pattern.amount,
      kind: isExpense ? 'expense' : 'income',
      source: 'recurring',
      confidence: pattern.confidence,
      category: pattern.category,
      status: 'forecast',
      notes: `זוהה אוטומטית מ-${pattern.occurrences} תנועות חוזרות (מאז ${formatDateHe(pattern.first_seen)})`,
    });
  }

  return out;
}

function guessCategory(description: string, amount: number): string {
  const d = description.toLowerCase();
  if (/ארנונה/.test(d)) return 'utilities';
  if (/חשמל|מים|גז|בזק|פרטנר|סלקום|הוט/.test(d)) return 'utilities';
  if (/שכ.?ד|שכר.?דירה|שכירות/.test(d)) return 'rent';
  if (/משכורת|שכר/.test(d)) return 'salaries';
  if (/netflix|spotify|google|apple|amazon|aws|מנוי/.test(d)) return 'subscriptions';
  if (/הלוואה|משכנתא|loan/.test(d)) return 'loan';
  if (/מס|מעמ|ביטוח לאומי/.test(d)) return 'tax';
  return 'other';
}

// ============================================================================
// Source 2: Pending invoices (expense + income that haven't been paid yet)
// ============================================================================

async function loadPendingInvoiceForecasts(
  admin: SupabaseClient,
  invoiceTableIds: string[],
  expenseTableId: string | null,
  today: Date,
  horizon: Date,
  onlyApproved: boolean = false
): Promise<any[]> {
  // Pull approval columns alongside data so we can score confidence correctly
  // and respect the "only approved" filter from the dashboard.
  let query = admin
    .from('records')
    .select('id, table_id, data, is_approved, record_number')
    .in('table_id', invoiceTableIds);

  if (onlyApproved) {
    // Hard filter: caller wants ONLY records that have been verified by an
    // authorized approver. Skip everything else.
    query = query.eq('is_approved', true);
  }

  const { data: invoices } = await query;

  if (!invoices) return [];

  const out: any[] = [];

  for (const inv of invoices) {
    const status = inv.data?.status || inv.data?.payment_status;
    const isPaid = status === 'paid' || status === 'sent_to_accountant';
    if (isPaid) continue;

    // Skip explicitly rejected records — they should never appear in forecasts
    if (inv.is_approved === false) continue;

    const isExpense = inv.table_id === expenseTableId;
    const amount = Number(inv.data?.amount ?? inv.data?.amount_total);
    if (!isFinite(amount) || amount === 0) continue;

    // Use payment_date if specified, else invoice_date + 30 days (shotef+30)
    let dueDate: Date;
    if (inv.data?.payment_date) {
      dueDate = new Date(inv.data.payment_date);
    } else {
      const baseDate = new Date(inv.data?.expense_date ?? inv.data?.invoice_date ?? today);
      dueDate = new Date(baseDate.getTime() + 30 * 86400000);
    }

    if (dueDate < today) {
      // Overdue - schedule for tomorrow at lower confidence
      dueDate = new Date(today.getTime() + 86400000);
    }
    if (dueDate > horizon) continue;

    const vendor = inv.data?.vendor_name ?? inv.data?.vendor ?? inv.data?.customer_name ?? 'חשבונית';

    // Confidence calibration:
    //   approved (is_approved=true)  → 95% (committed, verified)
    //   pending (is_approved=null)   → 70% (might still be rejected/edited)
    // This way the cashflow chart distinguishes verified expenses from
    // ones still under review, and the user can mentally apply the right
    // discount when planning.
    const confidence = inv.is_approved === true ? 95 : 70;
    const approvalNote = inv.is_approved === true
      ? '✅ מאושר'
      : '⏳ ממתין לאישור';

    out.push({
      expected_date: isoDate(dueDate),
      description: `${isExpense ? 'תשלום ל' : 'תקבול מ'}${vendor}`,
      amount: isExpense ? -Math.abs(amount) : Math.abs(amount),
      kind: isExpense ? 'expense' : 'income',
      source: 'pending_invoice',
      confidence,
      category: isExpense ? 'vendors' : 'customers',
      status: 'forecast',
      vat_amount: Number(inv.data?.vat_amount) || 0,
      record_id: inv.id,
      record_number: inv.record_number,
      is_approved: inv.is_approved,
      notes: `${approvalNote} · מחשבונית מס׳ ${inv.data?.invoice_number || inv.record_number || '?'}`,
    });
  }

  return out;
}

// ============================================================================
// Source 3: VAT obligations
// ============================================================================

async function calculateVatObligations(
  admin: SupabaseClient,
  expenseTableId: string | null,
  incomeTableId: string | null,
  today: Date,
  horizon: Date
): Promise<any[]> {
  const out: any[] = [];

  // Look at last 6 months of invoices to know what's due
  const lookbackDate = new Date();
  lookbackDate.setMonth(lookbackDate.getMonth() - 6);

  const tableIds = [expenseTableId, incomeTableId].filter(Boolean) as string[];
  if (tableIds.length === 0) return out;

  const { data: invoices } = await admin
    .from('records')
    .select('table_id, data')
    .in('table_id', tableIds)
    .gte('data->>invoice_date', isoDate(lookbackDate))
    .or(`data->>expense_date.gte.${isoDate(lookbackDate)},data->>invoice_date.gte.${isoDate(lookbackDate)}`);

  if (!invoices || invoices.length === 0) return out;

  // Aggregate VAT per (year, month) bucket
  const vatByMonth = new Map<string, { vatOut: number; vatIn: number; count: number }>();

  for (const inv of invoices) {
    const isIncome = inv.table_id === incomeTableId;
    const isExpense = inv.table_id === expenseTableId;
    const reportMonth = inv.data?.report_month; // "01" - "12"
    const invoiceDate = inv.data?.expense_date ?? inv.data?.invoice_date;
    if (!invoiceDate) continue;

    const dt = new Date(invoiceDate);
    const monthKey = `${dt.getFullYear()}-${String(reportMonth || dt.getMonth() + 1).padStart(2, '0')}`;

    const vat = Number(inv.data?.vat_amount) || 0;
    if (vat === 0) {
      // Estimate from amount if not explicit (assume 18% included)
      const total = Number(inv.data?.amount ?? inv.data?.amount_total);
      if (!isFinite(total)) continue;
      const estimated = Math.abs(total) - Math.abs(total) / (1 + VAT_RATE);
      const bucket = vatByMonth.get(monthKey) || { vatOut: 0, vatIn: 0, count: 0 };
      if (isIncome) bucket.vatOut += estimated;
      else if (isExpense) bucket.vatIn += estimated;
      bucket.count++;
      vatByMonth.set(monthKey, bucket);
    } else {
      const bucket = vatByMonth.get(monthKey) || { vatOut: 0, vatIn: 0, count: 0 };
      if (isIncome) bucket.vatOut += Math.abs(vat);
      else if (isExpense) bucket.vatIn += Math.abs(vat);
      bucket.count++;
      vatByMonth.set(monthKey, bucket);
    }
  }

  // VAT due on the 15th of the month *following* the report period
  for (const [monthKey, bucket] of vatByMonth.entries()) {
    const [yearStr, monthStr] = monthKey.split('-');
    const reportYear = parseInt(yearStr);
    const reportMonth = parseInt(monthStr); // 1-12

    // Due on 15th of next month
    const dueDate = new Date(reportYear, reportMonth, 15); // month is 0-indexed in Date, so this is next month's 15th
    if (dueDate < today) continue;
    if (dueDate > horizon) continue;

    const netVat = bucket.vatOut - bucket.vatIn;
    if (Math.abs(netVat) < 1) continue; // skip negligible

    out.push({
      expected_date: isoDate(dueDate),
      description: `מע״מ לחודש ${reportMonth}/${reportYear}`,
      amount: netVat > 0 ? -netVat : -netVat, // positive net = pay (negative cashflow), negative net = refund (positive)
      kind: netVat > 0 ? 'vat_payment' : 'vat_refund',
      source: 'vat_obligation',
      confidence: 100, // VAT is a legal certainty
      category: 'tax',
      status: 'forecast',
      vat_amount: Math.abs(netVat),
      vat_report_month: monthStr,
      notes: `חישוב: עסקאות ${bucket.vatOut.toFixed(0)}₪ - תשומות ${bucket.vatIn.toFixed(0)}₪ (${bucket.count} חשבוניות)`,
    });
  }

  return out;
}

// ============================================================================
// Source 4: Pipeline (CRM records with expected_value)
// AND Source 5: Project milestones (construction contracts with payment stages)
// ============================================================================

async function loadPipelineForecasts(
  admin: SupabaseClient,
  workspaceId: string,
  forecastTableId: string,
  today: Date,
  horizon: Date
): Promise<any[]> {
  const out: any[] = [];

  // ---------- Part A: Generic CRM pipeline ----------
  // Find all tables in workspace that have an "expected_value" or "deal_value" field
  const { data: pipelineFields } = await admin
    .from('fields')
    .select('table_id, slug, name')
    .eq('workspace_id', workspaceId)
    .in('slug', ['expected_value', 'deal_value', 'potential_value']);

  const pipelineTableIds = Array.from(
    new Set((pipelineFields || []).map((f: any) => f.table_id))
  ).filter((id) => id !== forecastTableId);

  if (pipelineTableIds.length > 0) {
    const { data: pipelineRecords } = await admin
      .from('records')
      .select('id, table_id, data')
      .in('table_id', pipelineTableIds);

    for (const rec of pipelineRecords || []) {
      const value = Number(
        rec.data?.expected_value ??
        rec.data?.deal_value ??
        rec.data?.potential_value
      );
      if (!isFinite(value) || value <= 0) continue;

      let probability = Number(rec.data?.probability ?? rec.data?.close_probability);
      if (!isFinite(probability)) {
        probability = probabilityFromStatus(rec.data?.status || rec.data?.stage);
      }
      if (probability < 10) continue;

      let expectedDate: Date;
      const explicitDate = rec.data?.expected_close_date ?? rec.data?.close_date;
      if (explicitDate) {
        expectedDate = new Date(explicitDate);
      } else {
        expectedDate = new Date(today.getTime() + 30 * 86400000);
      }

      if (expectedDate < today || expectedDate > horizon) continue;

      const name = rec.data?.name ?? rec.data?.customer_name ?? rec.data?.lead_name ?? 'הזדמנות';

      out.push({
        expected_date: isoDate(expectedDate),
        description: `הזדמנות: ${name}`,
        amount: value,
        kind: 'income',
        source: 'pipeline',
        confidence: Math.round(probability),
        category: 'customers',
        status: 'forecast',
        notes: `סיכוי סגירה: ${probability}%${rec.data?.stage ? ` · שלב: ${rec.data.stage}` : ''}`,
      });
    }
  }

  // ---------- Part B: Project milestones (construction / contracted work) ----------
  // Looks for tables with a "project_value" or "contract_value" field — typical
  // for construction contractors, builders, engineering firms, etc.
  // Each project can have a "milestones" JSONB field shaped like:
  //   [{ "name": "גמר יסודות", "amount": 50000, "expected_date": "2026-05-15", "completed": false }]
  const { data: projectFields } = await admin
    .from('fields')
    .select('table_id')
    .eq('workspace_id', workspaceId)
    .in('slug', ['project_value', 'contract_value', 'project_total']);

  const projectTableIds = Array.from(
    new Set((projectFields || []).map((f: any) => f.table_id))
  ).filter((id) => id !== forecastTableId);

  if (projectTableIds.length > 0) {
    const { data: projectRecords } = await admin
      .from('records')
      .select('id, data')
      .in('table_id', projectTableIds);

    for (const rec of projectRecords || []) {
      const milestones = rec.data?.milestones;
      if (!Array.isArray(milestones) || milestones.length === 0) continue;

      const projectName = rec.data?.name ?? rec.data?.project_name ?? rec.data?.customer_name ?? 'פרויקט';
      const status = String(rec.data?.status || '').toLowerCase();
      const isActive = !/cancelled|completed|הסתיים|בוטל/.test(status);

      for (const milestone of milestones) {
        if (!milestone || typeof milestone !== 'object') continue;
        if (milestone.completed === true || milestone.paid === true) continue;
        if (!isActive) continue;

        const amount = Number(milestone.amount);
        const dateStr = milestone.expected_date ?? milestone.due_date;
        if (!isFinite(amount) || amount <= 0 || !dateStr) continue;

        const milestoneDate = new Date(dateStr);
        if (milestoneDate < today || milestoneDate > horizon) continue;

        // Confidence based on project status:
        // - Signed contract = 90% (binding but timing might shift)
        // - In progress = 95% (close to delivery, very likely)
        // - Other (proposal etc) = 60%
        let confidence = 60;
        if (/active|in.?progress|בביצוע|פעיל/.test(status)) confidence = 95;
        else if (/signed|approved|חתום|מאושר/.test(status)) confidence = 90;

        // Manually-set milestone confidence overrides the default
        if (typeof milestone.confidence === 'number') {
          confidence = Math.round(milestone.confidence);
        }

        out.push({
          expected_date: isoDate(milestoneDate),
          description: `${projectName} — ${milestone.name || 'אבן דרך'}`,
          amount,
          kind: 'income',
          source: 'pipeline',
          confidence,
          category: 'customers',
          status: 'forecast',
          notes: `אבן דרך מפרויקט · יזם/לקוח: ${rec.data?.customer_name || rec.data?.client || '?'}`,
        });
      }
    }
  }

  return out;
}

function probabilityFromStatus(status: any): number {
  const s = String(status || '').toLowerCase();
  if (/won|closed|signed|הושלם|נחתם|זכה/.test(s)) return 100;
  if (/negotiation|proposal|הצעה|מו.?מ/.test(s)) return 75;
  if (/qualified|interested|מעוניין|מתעניין/.test(s)) return 50;
  if (/contacted|cold|פגישה/.test(s)) return 30;
  if (/new|lead|חדש|ליד/.test(s)) return 20;
  if (/lost|rejected|הפסיד/.test(s)) return 0;
  return 25; // unknown status = low confidence
}

// ============================================================================
// Helpers
// ============================================================================

async function getForecastHorizonDays(
  admin: SupabaseClient,
  workspaceId: string
): Promise<number> {
  const { data: ws } = await admin
    .from('workspaces')
    .select('plan, limit_overrides')
    .eq('id', workspaceId)
    .single();
  if (!ws) return DEFAULT_HORIZON_DAYS;

  // Check overrides first
  const override = (ws.limit_overrides as any)?.cashflow_forecast_days;
  if (typeof override === 'number') return override;

  const { data: planRow } = await admin
    .from('plan_limits')
    .select('cashflow_forecast_days, feature_cashflow')
    .eq('plan', ws.plan)
    .single();

  if (!planRow?.feature_cashflow) {
    throw new Error('Cashflow feature not enabled for this plan');
  }

  return planRow.cashflow_forecast_days || DEFAULT_HORIZON_DAYS;
}

function forecastSignature(forecast: any): string | null {
  const date = forecast?.expected_date;
  const kind = forecast?.kind;
  const desc = String(forecast?.description || '').slice(0, 40).toLowerCase().trim();
  const amount = Math.round(Number(forecast?.amount) || 0);
  if (!date || !kind || !desc) return null;
  return `${kind}|${date}|${desc}|${amount}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateHe(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
