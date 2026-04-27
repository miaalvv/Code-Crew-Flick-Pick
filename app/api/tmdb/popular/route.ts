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
  const results = (data.results ?? []) as Array<{ id: number }>;

  // Enrich each movie with an official trailer key when available
  const withTrailers = await Promise.all(
    results.map(async (movie) => {
      try {
        const videoUrl = isV4
          ? `${TMDB_BASE}/movie/${movie.id}/videos?language=en-US`
          : `${TMDB_BASE}/movie/${movie.id}/videos?language=en-US&api_key=${encodeURIComponent(key)}`;

        const videoRes = await fetch(videoUrl, { headers, cache: 'no-store' });
        const videoData = await videoRes.json();
        const videos = (videoData.results ?? []) as Array<{
          key?: string;
          site?: string;
          type?: string;
          official?: boolean;
          name?: string;
        }>;

        const trailer =
          // Prefer official trailers
          videos.find((v) => v.type === 'Trailer' && v.site === 'YouTube' && v.official) ||
          // Then any YouTube trailer
          videos.find((v) => v.type === 'Trailer' && v.site === 'YouTube') ||
          // Then YouTube teasers (still playable, closer than search)
          videos.find((v) => v.type === 'Teaser' && v.site === 'YouTube') ||
          // Finally any YouTube video
          videos.find((v) => v.site === 'YouTube');

        return { ...movie, trailerKey: trailer?.key ?? null };
      } catch (e) {
        console.error('Trailer fetch failed for movie', movie.id, e);
        return { ...movie, trailerKey: null };
      }
    })
  );

  return NextResponse.json({ ok: true, results: withTrailers });
}
