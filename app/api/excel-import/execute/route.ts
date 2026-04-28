import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * POST /api/excel-import/execute
 *
 * Step 2 of the Excel import flow. The user has reviewed/edited the
 * AI-proposed mapping and confirmed it. We re-parse the file, apply the
 * mapping, and insert records into the destination table.
 *
 * Body (multipart/form-data):
 *   - file: the same Excel/CSV file (re-uploaded since we don't store it server-side)
 *   - import_id: UUID returned from /analyze
 *   - mapping: JSON string of { source_col: target_field_slug | null }
 *   - skip_duplicates: 'true' | 'false' (default true) — skip rows that already exist
 *
 * Response:
 *   {
 *     import_id: UUID,
 *     rows_imported: number,
 *     rows_skipped: number,
 *     rows_failed: number,
 *     duplicate_rows: number,
 *     sample_inserted: any[]
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const importId = formData.get('import_id') as string | null;
    const mappingJson = formData.get('mapping') as string | null;
    const skipDuplicates = formData.get('skip_duplicates') !== 'false';

    if (!file || !importId || !mappingJson) {
      return NextResponse.json(
        { error: 'file, import_id, and mapping are required' },
        { status: 400 }
      );
    }

    let mapping: Record<string, string | null>;
    try {
      mapping = JSON.parse(mappingJson);
    } catch {
      return NextResponse.json({ error: 'invalid mapping JSON' }, { status: 400 });
    }

    // Load the import record
    const admin = createAdminClient();
    const { data: importRecord } = await admin
      .from('excel_imports')
      .select('*')
      .eq('id', importId)
      .single();
    if (!importRecord) {
      return NextResponse.json({ error: 'import not found' }, { status: 404 });
    }

    // Verify membership matches the import's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', importRecord.workspace_id)
      .eq('user_id', user.id)
      .single();
    if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Mark as importing
    await admin
      .from('excel_imports')
      .update({ status: 'importing', column_mapping: mapping })
      .eq('id', importId);

    // Load destination table fields to validate types
    const { data: fields } = await admin
      .from('fields')
      .select('id, name, slug, type, is_required, config')
      .eq('table_id', importRecord.table_id);

    const fieldsBySlug = new Map<string, any>((fields || []).map((f: any) => [f.slug, f]));

    // Re-parse the file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    // Find header row (first non-empty row)
    let headerRowIdx = 0;
    while (
      headerRowIdx < rawRows.length &&
      rawRows[headerRowIdx].every((c) => !c || String(c).trim() === '')
    ) {
      headerRowIdx++;
    }
    const headers: string[] = rawRows[headerRowIdx].map((h) => String(h || '').trim());
    const dataRows = rawRows.slice(headerRowIdx + 1).filter((r) => r.some((c) => c !== ''));

    // Build header → column-index map for fast lookup
    const headerIdx = new Map<string, number>();
    headers.forEach((h, i) => headerIdx.set(h, i));

    // Load existing records for duplicate detection (only if needed).
    // We dedupe on a canonical signature: amount + date + description.
    let existingSignatures = new Set<string>();
    if (skipDuplicates) {
      const { data: existingRecs } = await admin
        .from('records')
        .select('data')
        .eq('table_id', importRecord.table_id)
        .limit(5000); // cap to avoid huge memory hits

      for (const r of existingRecs || []) {
        const sig = signatureFor(r.data || {});
        if (sig) existingSignatures.add(sig);
      }
    }

    // Process each data row
    const recordsToInsert: any[] = [];
    const sampleInserted: any[] = [];
    let duplicateCount = 0;
    let failedCount = 0;
    const failures: { rowNum: number; reason: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const recordData: Record<string, any> = {};

      // Apply mapping: for each source col with a target field, copy the value
      for (const [sourceCol, targetSlug] of Object.entries(mapping)) {
        if (!targetSlug) continue;
        const colIdx = headerIdx.get(sourceCol);
        if (colIdx === undefined) continue;
        const rawValue = row[colIdx];
        if (rawValue === undefined || rawValue === null || rawValue === '') continue;

        const field = fieldsBySlug.get(targetSlug);
        if (!field) continue;

        try {
          recordData[targetSlug] = coerceValue(rawValue, field.type);
        } catch (e: any) {
          // Type coercion failed — skip this cell, don't fail the whole row
        }
      }

      // Skip rows where we couldn't extract any meaningful data
      if (Object.keys(recordData).length === 0) {
        failedCount++;
        if (failures.length < 10) {
          failures.push({ rowNum: i + 1, reason: 'no mappable data' });
        }
        continue;
      }

      // Duplicate check
      if (skipDuplicates) {
        const sig = signatureFor(recordData);
        if (sig && existingSignatures.has(sig)) {
          duplicateCount++;
          continue;
        }
        if (sig) existingSignatures.add(sig); // also dedupe within this batch
      }

      recordsToInsert.push({
        table_id: importRecord.table_id,
        workspace_id: importRecord.workspace_id,
        data: recordData,
        source: 'import',
        created_by: user.id,
      });

      if (sampleInserted.length < 3) {
        sampleInserted.push(recordData);
      }
    }

    // Bulk insert in chunks of 500
    let actualInserted = 0;
    const chunkSize = 500;
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      const { error: insertErr, data: inserted } = await admin
        .from('records')
        .insert(chunk)
        .select('id');
      if (insertErr) {
        console.error(`Chunk ${i / chunkSize} insert failed`, insertErr);
        failedCount += chunk.length;
      } else {
        actualInserted += inserted?.length || 0;
      }
    }

    // Update import record with final stats
    await admin
      .from('excel_imports')
      .update({
        status: failedCount === recordsToInsert.length ? 'failed' : 'completed',
        rows_imported: actualInserted,
        rows_skipped: 0,
        rows_failed: failedCount,
        duplicate_rows: duplicateCount,
        completed_at: new Date().toISOString(),
        error_message:
          failures.length > 0
            ? `${failures.length} rows failed: ${failures
                .slice(0, 3)
                .map((f) => `row ${f.rowNum}: ${f.reason}`)
                .join('; ')}`
            : null,
      })
      .eq('id', importId);

    return NextResponse.json({
      import_id: importId,
      rows_imported: actualInserted,
      rows_skipped: 0,
      rows_failed: failedCount,
      duplicate_rows: duplicateCount,
      sample_inserted: sampleInserted,
    });
  } catch (e: any) {
    console.error('Excel execute error', e);
    return NextResponse.json(
      { error: e?.message || 'failed to execute import' },
      { status: 500 }
    );
  }
}

/**
 * Coerce a raw cell value to the destination field type.
 * Throws if value is incompatible (caller catches and skips the cell).
 */
function coerceValue(raw: any, type: string): any {
  const str = String(raw).trim();

  switch (type) {
    case 'number':
    case 'currency': {
      // Handle Israeli formats: "1,234.56" or "1.234,56" or "₪ 100.00" or "(50.00)" for negatives
      let cleaned = str.replace(/[₪$€,\s]/g, '');
      let isNegative = false;
      if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
        isNegative = true;
        cleaned = cleaned.slice(1, -1);
      } else if (cleaned.startsWith('-')) {
        isNegative = true;
        cleaned = cleaned.slice(1);
      }
      const num = parseFloat(cleaned);
      if (isNaN(num)) throw new Error('not a number');
      return isNegative ? -num : num;
    }

    case 'date':
    case 'datetime': {
      // Try common formats: ISO, DD/MM/YYYY, DD-MM-YYYY
      // xlsx with cellDates:true gives us Date objects directly when possible
      if (raw instanceof Date) {
        return raw.toISOString().slice(0, type === 'date' ? 10 : 19);
      }
      // Try parsing DD/MM/YYYY (Israeli convention)
      const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
      if (ddmmyyyy) {
        const [, dd, mm, yy] = ddmmyyyy;
        const year = yy.length === 2 ? `20${yy}` : yy;
        const iso = `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        return type === 'date' ? iso : `${iso}T00:00:00`;
      }
      // ISO already
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        return d.toISOString().slice(0, type === 'date' ? 10 : 19);
      }
      throw new Error('invalid date');
    }

    case 'checkbox':
      return ['true', '1', 'כן', 'yes', 'y', 'v'].includes(str.toLowerCase());

    case 'text':
    case 'longtext':
    case 'phone':
    case 'email':
    case 'url':
    case 'select':
    case 'status':
    case 'multiselect':
    default:
      return str;
  }
}

/**
 * Build a duplicate-detection signature for a record.
 * Uses amount + date + a snippet of description to catch the common case
 * of re-importing the same bank statement.
 */
function signatureFor(data: Record<string, any>): string | null {
  const amount = data.amount ?? data.amount_total;
  const date = data.transaction_date ?? data.expense_date ?? data.invoice_date ?? data.date;
  const desc = data.description ?? data.vendor ?? data.customer_name ?? '';

  if (amount === undefined || amount === null || !date) return null;
  return `${date}|${amount}|${String(desc).slice(0, 30).toLowerCase().trim()}`;
}
