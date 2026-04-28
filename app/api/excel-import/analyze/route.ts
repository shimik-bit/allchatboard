import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import OpenAI from 'openai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // AI mapping can take ~10-20s

/**
 * POST /api/excel-import/analyze
 *
 * Step 1 of the Excel import flow. Parses an uploaded .xlsx/.csv file,
 * extracts the headers + a sample of rows, and asks AI to propose a
 * mapping from source columns → target field slugs.
 *
 * Body (multipart/form-data):
 *   - file: the Excel/CSV file
 *   - workspace_id: UUID
 *   - table_id: UUID of the destination table
 *
 * Response:
 *   {
 *     import_id: UUID,
 *     headers: string[],
 *     sample_rows: any[][],
 *     total_rows: number,
 *     detected_bank: string | null,
 *     proposed_mapping: { [source_col]: target_field_slug | null },
 *     confidence: number (0-1),
 *     needs_manual_review: boolean
 *   }
 */
export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const workspaceId = formData.get('workspace_id') as string | null;
    const tableId = formData.get('table_id') as string | null;

    if (!file || !workspaceId || !tableId) {
      return NextResponse.json(
        { error: 'file, workspace_id, and table_id are required' },
        { status: 400 }
      );
    }

    // Verify membership
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single();
    if (!membership || !['owner', 'admin', 'editor'].includes(membership.role)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    // Verify table belongs to workspace + load its fields
    const admin = createAdminClient();
    const { data: table } = await admin
      .from('tables')
      .select('id, name, slug, workspace_id')
      .eq('id', tableId)
      .eq('workspace_id', workspaceId)
      .single();
    if (!table) {
      return NextResponse.json({ error: 'table not found' }, { status: 404 });
    }

    const { data: fields } = await admin
      .from('fields')
      .select('id, name, slug, type, ai_extraction_hint, config')
      .eq('table_id', tableId)
      .order('position');

    if (!fields || fields.length === 0) {
      return NextResponse.json({ error: 'table has no fields' }, { status: 400 });
    }

    // Parse the Excel/CSV file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: 'file has no sheets' }, { status: 400 });
    }
    const sheet = workbook.Sheets[firstSheetName];

    // Get raw rows as 2D array (header: 1 means first row is headers)
    const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: '',
    });

    if (rawRows.length < 2) {
      return NextResponse.json(
        { error: 'file must have at least one header row and one data row' },
        { status: 400 }
      );
    }

    // First non-empty row is headers
    let headerRowIdx = 0;
    while (
      headerRowIdx < rawRows.length &&
      rawRows[headerRowIdx].every((c) => !c || String(c).trim() === '')
    ) {
      headerRowIdx++;
    }
    const headers: string[] = rawRows[headerRowIdx].map((h) => String(h || '').trim());
    const dataRows = rawRows.slice(headerRowIdx + 1).filter((row) => row.some((c) => c !== ''));

    // Take first 5 rows as sample for AI
    const sampleRows = dataRows.slice(0, 5);
    const totalRows = dataRows.length;

    // Detect bank from filename or first cells
    const detectedBank = detectBank(file.name, headers, dataRows.slice(0, 3));

    // Ask AI to propose column mapping
    const apiKey = process.env.OPENAI_API_KEY;
    let proposedMapping: Record<string, string | null> = {};
    let confidence = 0;

    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const targetFields = fields.map((f: any) => ({
        slug: f.slug,
        name: f.name,
        type: f.type,
        hint: f.ai_extraction_hint || null,
      }));

      const prompt = `You are mapping columns from an Excel file to fields in a database table.

DESTINATION TABLE: "${table.name}"
TARGET FIELDS:
${targetFields.map((f: any) => `  - ${f.slug} ("${f.name}", type: ${f.type})${f.hint ? ` // ${f.hint}` : ''}`).join('\n')}

SOURCE EXCEL COLUMNS (with sample values):
${headers
  .map((h, i) => {
    const samples = sampleRows.map((r) => String(r[i] ?? '')).filter((v) => v).slice(0, 3);
    return `  ${i + 1}. "${h}" — examples: ${samples.join(' | ') || '(empty)'}`;
  })
  .join('\n')}

${detectedBank ? `DETECTED BANK: ${detectedBank}` : ''}

For each source column, decide which target field it maps to (or null if no good match).
Return ONLY a JSON object with this shape (no markdown, no explanation):

{
  "mapping": { "source_column_name": "target_field_slug_or_null", ... },
  "confidence": 0.0-1.0,
  "notes": "brief explanation of any uncertainties"
}`;

      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a precise data-mapping assistant. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0,
          response_format: { type: 'json_object' },
        });

        const aiResponse = JSON.parse(completion.choices[0]?.message?.content || '{}');
        proposedMapping = aiResponse.mapping || {};
        confidence = Number(aiResponse.confidence) || 0;
      } catch (e: any) {
        console.error('AI mapping failed', e);
        // Fall back to fuzzy matching
        proposedMapping = fuzzyMatchHeaders(headers, fields);
        confidence = 0.3;
      }
    } else {
      // No AI - use fuzzy matching
      proposedMapping = fuzzyMatchHeaders(headers, fields);
      confidence = 0.4;
    }

    const needsManualReview = confidence < 0.8;

    // Save the import record (status: awaiting_mapping)
    const { data: importRecord, error: insertErr } = await admin
      .from('excel_imports')
      .insert({
        workspace_id: workspaceId,
        table_id: tableId,
        file_name: file.name,
        file_size_kb: Math.ceil(file.size / 1024),
        source_type: detectedBank ? 'bank_statement' : 'other',
        detected_bank: detectedBank,
        column_mapping: proposedMapping,
        mapping_confidence: confidence,
        needed_manual_mapping: needsManualReview,
        total_rows: totalRows,
        status: 'awaiting_mapping',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertErr) {
      console.error('Failed to save import record', insertErr);
      return NextResponse.json({ error: 'failed to create import record' }, { status: 500 });
    }

    return NextResponse.json({
      import_id: importRecord.id,
      headers,
      sample_rows: sampleRows,
      total_rows: totalRows,
      detected_bank: detectedBank,
      proposed_mapping: proposedMapping,
      confidence,
      needs_manual_review: needsManualReview,
    });
  } catch (e: any) {
    console.error('Excel analyze error', e);
    return NextResponse.json(
      { error: e?.message || 'failed to analyze file' },
      { status: 500 }
    );
  }
}

/**
 * Detect Israeli bank from filename or header content.
 * Used by the AI as a hint and stored on the import record for analytics.
 */
function detectBank(filename: string, headers: string[], firstRows: any[][]): string | null {
  const lc = filename.toLowerCase();
  const allText = (headers.join(' ') + ' ' + firstRows.flat().join(' ')).toLowerCase();

  const banks: Record<string, RegExp[]> = {
    leumi: [/לאומי/, /\bleumi\b/],
    hapoalim: [/הפועלים/, /\bhapoalim\b/, /\bbank\s*hapoalim\b/],
    discount: [/דיסקונט/, /\bdiscount\b/],
    mizrahi: [/מזרחי/, /טפחות/, /\bmizrahi\b/, /\btefahot\b/],
    fibi: [/הבינלאומי/, /\bfibi\b/, /\binternational\b/],
    yahav: [/יהב/, /\byahav\b/],
    mercantile: [/מרכנתיל/, /\bmercantile\b/],
    one_zero: [/one.?zero/, /\bonezero\b/],
    pepper: [/פפר/, /\bpepper\b/],
    esh: [/אש\s*ישראל/, /\besh\b/],
  };

  for (const [bank, patterns] of Object.entries(banks)) {
    if (patterns.some((p) => p.test(lc) || p.test(allText))) {
      return bank;
    }
  }
  return null;
}

/**
 * Cheap fallback when AI isn't available — does naive string matching
 * between source headers and target field names/slugs.
 */
function fuzzyMatchHeaders(
  headers: string[],
  fields: any[]
): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const usedSlugs = new Set<string>();

  for (const header of headers) {
    if (!header) continue;
    const h = header.toLowerCase().trim();

    // Try exact slug match first
    let match = fields.find((f: any) => !usedSlugs.has(f.slug) && f.slug === h);

    // Then exact name match
    if (!match) {
      match = fields.find((f: any) => !usedSlugs.has(f.slug) && f.name === header);
    }

    // Then partial name match
    if (!match) {
      match = fields.find(
        (f: any) =>
          !usedSlugs.has(f.slug) &&
          (f.name.includes(header) || header.includes(f.name))
      );
    }

    if (match) {
      result[header] = match.slug;
      usedSlugs.add(match.slug);
    } else {
      result[header] = null;
    }
  }

  return result;
}
