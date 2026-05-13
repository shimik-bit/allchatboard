// Thin wrappers around the Google Sheets + Drive APIs for the
// integration-settings flow.
//
// All functions take a pre-built OAuth2Client (use getAuthedGoogleClient
// from ./connection.ts to obtain one). They don't do any DB access and
// don't know about workspaces — they're pure API plumbing.

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export type SpreadsheetSummary = {
  id: string;
  name: string;
  url: string;
  modifiedAt: string;
};

export type SheetTab = {
  sheetId: number;
  title: string;
};

/**
 * List recent spreadsheets owned by or shared with the user.
 *
 * Limited to 50 most recently-modified to keep the picker fast. The user
 * can always paste a sheet URL directly for older ones.
 *
 * Note: with the `drive.file` scope this only returns files the
 * TaskFlow app has previously interacted with. That's by design — for
 * existing sheets the user wants to write to, they'll use the URL paste
 * flow (which surfaces the picker UI client-side).
 */
export async function listRecentSpreadsheets(
  client: OAuth2Client,
): Promise<SpreadsheetSummary[]> {
  const drive = google.drive({ version: 'v3', auth: client });

  const res = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    orderBy: 'modifiedTime desc',
    pageSize: 50,
    fields: 'files(id, name, webViewLink, modifiedTime)',
  });

  return (res.data.files ?? [])
    .filter((f): f is { id: string; name: string; webViewLink: string; modifiedTime: string } =>
      Boolean(f.id && f.name && f.webViewLink && f.modifiedTime),
    )
    .map((f) => ({
      id: f.id,
      name: f.name,
      url: f.webViewLink,
      modifiedAt: f.modifiedTime,
    }));
}

/**
 * Get the list of tab (worksheet) names inside a spreadsheet. The user
 * picks which tab to write to during sync setup.
 */
export async function listSheetTabs(
  client: OAuth2Client,
  spreadsheetId: string,
): Promise<SheetTab[]> {
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(sheetId,title))',
  });

  return (res.data.sheets ?? [])
    .map((s) => s.properties)
    .filter((p): p is { sheetId: number; title: string } =>
      typeof p?.sheetId === 'number' && typeof p?.title === 'string',
    )
    .map((p) => ({ sheetId: p.sheetId, title: p.title }));
}

/**
 * Get basic metadata for a spreadsheet by id (name + URL).
 * Used after the user pastes a URL to verify it works and to cache
 * the name for the UI.
 */
export async function getSpreadsheetInfo(
  client: OAuth2Client,
  spreadsheetId: string,
): Promise<SpreadsheetSummary | null> {
  const sheets = google.sheets({ version: 'v4', auth: client });
  try {
    const res = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'spreadsheetId,properties(title),spreadsheetUrl',
    });
    return {
      id: res.data.spreadsheetId ?? spreadsheetId,
      name: res.data.properties?.title ?? 'Untitled',
      url: res.data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      modifiedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Create a brand-new spreadsheet with a single tab named per the caller.
 * Returns id + URL so the UI can link to it.
 *
 * Created files are owned by the user (per `drive.file` scope semantics)
 * and appear in their My Drive automatically.
 */
export async function createSpreadsheet(
  client: OAuth2Client,
  title: string,
  initialTabName: string = 'Sheet1',
): Promise<SpreadsheetSummary> {
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title },
      sheets: [{ properties: { title: initialTabName } }],
    },
    fields: 'spreadsheetId,spreadsheetUrl,properties(title)',
  });

  if (!res.data.spreadsheetId) {
    throw new Error('Sheets API did not return a spreadsheetId.');
  }

  return {
    id: res.data.spreadsheetId,
    name: res.data.properties?.title ?? title,
    url:
      res.data.spreadsheetUrl ??
      `https://docs.google.com/spreadsheets/d/${res.data.spreadsheetId}`,
    modifiedAt: new Date().toISOString(),
  };
}

/**
 * Extract a spreadsheet ID from a Google Sheets URL. Returns null if the
 * URL isn't recognised. Used in the "paste a URL" flow.
 *
 * Supported formats:
 *   https://docs.google.com/spreadsheets/d/{id}/edit
 *   https://docs.google.com/spreadsheets/d/{id}/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/{id}
 */
export function extractSpreadsheetIdFromUrl(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}
