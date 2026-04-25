import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 86400; // cache for 24h on Vercel edge

/**
 * GET /api/cities?q=<query>
 *
 * Returns up to 20 matching Israeli cities from data.gov.il.
 * Used by the CityAutocomplete component for the customers/clients table.
 *
 * - Uses the official government dataset (resource_id 5c78e9fa)
 * - Normalizes Hebrew names (trims, removes weird whitespace)
 * - Cached for 24 hours per query
 */

const RESOURCE_ID = '5c78e9fa-c2e2-4771-93ff-7f400a12f7ba';
const API_BASE = 'https://data.gov.il/api/3/action/datastore_search';

type GovRow = Record<string, any>;

function normalize(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\s+/g, ' ').trim();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '15', 10), 50);

  // For empty query, return a popular preset list (not the whole 1400)
  if (!q) {
    return NextResponse.json({
      cities: POPULAR_CITIES,
      cached: true,
    }, {
      headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  }

  try {
    const url = new URL(API_BASE);
    url.searchParams.set('resource_id', RESOURCE_ID);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: { 'accept': 'application/json' },
      // Vercel will cache automatically based on revalidate
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      // Don't fail the user — fall back to popular list filtered locally
      return NextResponse.json({
        cities: POPULAR_CITIES.filter((c) => c.name.includes(q)),
        fallback: true,
        error: `gov.il returned ${res.status}`,
      });
    }

    const data = await res.json();
    const records: GovRow[] = data?.result?.records || [];

    const cities = records
      .map((r) => ({
        name: normalize(r['שם_ישוב']),
        district: normalize(r['שם_נפה']),
        region: normalize(r['לשכה']),
        code: normalize(r['סמל_ישוב']),
      }))
      .filter((c) => c.name && c.name.length > 0)
      // De-duplicate by name (gov data sometimes has duplicates)
      .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
      .slice(0, limit);

    return NextResponse.json({ cities }, {
      headers: { 'cache-control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch (err: any) {
    // Network failure - fall back to popular list
    return NextResponse.json({
      cities: POPULAR_CITIES.filter((c) => c.name.includes(q)),
      fallback: true,
      error: err?.message || 'unknown error',
    });
  }
}

// Fallback list shown when query is empty or gov.il is unreachable
const POPULAR_CITIES = [
  { name: 'תל אביב - יפו', district: 'תל אביב' },
  { name: 'ירושלים', district: 'ירושלים' },
  { name: 'חיפה', district: 'חיפה' },
  { name: 'ראשון לציון', district: 'תל אביב' },
  { name: 'פתח תקווה', district: 'תל אביב' },
  { name: 'אשדוד', district: 'אשקלון' },
  { name: 'נתניה', district: 'תל אביב' },
  { name: 'באר שבע', district: 'באר שבע' },
  { name: 'בני ברק', district: 'תל אביב' },
  { name: 'חולון', district: 'תל אביב' },
  { name: 'רמת גן', district: 'תל אביב' },
  { name: 'אשקלון', district: 'אשקלון' },
  { name: 'רחובות', district: 'רחובות' },
  { name: 'בת ים', district: 'תל אביב' },
  { name: 'הרצליה', district: 'תל אביב' },
  { name: 'כפר סבא', district: 'תל אביב' },
  { name: 'מודיעין-מכבים-רעות', district: 'רמלה' },
  { name: 'נצרת', district: 'נצרת' },
  { name: 'רעננה', district: 'תל אביב' },
  { name: 'רמלה', district: 'רמלה' },
  { name: 'לוד', district: 'רמלה' },
  { name: 'נהריה', district: 'עכו' },
  { name: 'גבעתיים', district: 'תל אביב' },
  { name: 'עפולה', district: 'יזרעאל' },
  { name: 'אילת', district: 'באר שבע' },
  { name: 'דימונה', district: 'באר שבע' },
  { name: 'טבריה', district: 'כנרת' },
  { name: 'קרית גת', district: 'אשקלון' },
  { name: 'נס ציונה', district: 'רחובות' },
  { name: 'עכו', district: 'עכו' },
  { name: 'אלעד', district: 'תל אביב' },
  { name: 'יבנה', district: 'רחובות' },
  { name: 'הוד השרון', district: 'תל אביב' },
  { name: 'רמת השרון', district: 'תל אביב' },
];
