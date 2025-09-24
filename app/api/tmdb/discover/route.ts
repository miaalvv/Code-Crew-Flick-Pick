import { NextResponse } from "next/server";

type RawMovie = {
  id: number;
  title?: string;
  name?: string;               // sometimes TMDB uses name (for TV)
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
  release_date?: string;
};

type TMDBDiscoverResponse = {
  page: number;
  total_pages: number;
  results: RawMovie[];
};

type QueryValue = string | number | boolean | undefined | null;
type QueryParams = Record<string, QueryValue>;

const TMDB = (path: string, params: QueryParams = {}) => {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  });
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
  });
};

// helper: comma-join unique provider ids
const toParam = (ids: number[]) => Array.from(new Set(ids)).join("|");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider_ids = [], region = "US", page = 1, max_runtime, genres } = body;

    const res = await TMDB("/discover/movie", {
      include_adult: "false",
      include_video: "false",
      language: "en-US",
      sort_by: "popularity.desc",
      watch_region: region,
      with_watch_providers: toParam(provider_ids),
      with_watch_monetization_types: "flatrate|ads|free",
      page,
      with_runtime_lte: max_runtime ?? undefined,
      with_genres: genres?.length ? genres.join(",") : undefined,
    });

    if (!res.ok) return NextResponse.json({ ok: false, status: res.status }, { status: 500 });
    const data: TMDBDiscoverResponse = await res.json();

    const results = (data.results ?? []).map((r: RawMovie) => ({
      id: r.id,
      title: r.title ?? r.name ?? "Untitled",
      poster_path: r.poster_path,
      overview: r.overview ?? "",
      vote_average: r.vote_average ?? 0,
      release_date: r.release_date ?? "",
      media_type: "movie" as const,
    }));

    return NextResponse.json({ ok: true, page: data.page, total_pages: data.total_pages, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
