import { NextResponse } from 'next/server';
const TMDB_BASE = 'https://api.themoviedb.org/3';

export async function GET() {
  const raw = process.env.TMDB_API_KEY ?? process.env.TMDB_KEY;
  if (!raw) {
    return NextResponse.json({ ok: false, error: 'Missing TMDB key' }, { status: 500 });
  }

  const key = raw.trim();
  const isV4 = key.startsWith('ey') || key.startsWith('Bearer ');

  const url = isV4
    ? `${TMDB_BASE}/movie/popular?language=en-US&page=1`
    : `${TMDB_BASE}/movie/popular?language=en-US&page=1&api_key=${encodeURIComponent(key)}`;

  const headers = isV4
    ? { Authorization: key.startsWith('Bearer ') ? key : `Bearer ${key}` }
    : undefined;

  const res = await fetch(url, { headers, cache: 'no-store' });
  const data = await res.json();

  return NextResponse.json({ ok: true, results: data.results ?? [] });
}
