import { NextResponse } from "next/server";

type TmdbGenre = {
  id: number;
  name: string;
};

type TmdbDetails = {
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  runtime?: number;
  episode_run_time?: number[];
  genres?: TmdbGenre[];
  vote_average?: number;
  number_of_seasons?: number;
};

const TMDB = (path: string) =>
  fetch(`https://api.themoviedb.org/3${path}`, {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
  });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const tmdb_id = Number(body?.tmdb_id);
    const media_type = body?.media_type === "tv" ? "tv" : "movie";

    if (!tmdb_id) {
      return NextResponse.json({ ok: false, error: "tmdb_id is required" }, { status: 400 });
    }

    const res = await TMDB(`/${media_type}/${tmdb_id}?language=en-US`);
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `TMDB error: ${res.status}` }, { status: 500 });
    }

    const data: TmdbDetails = await res.json();

    return NextResponse.json({
      ok: true,
      details: {
        overview: data.overview ?? "",
        release_date: data.release_date ?? data.first_air_date ?? "",
        runtime: media_type === "tv" ? data.episode_run_time?.[0] ?? null : data.runtime ?? null,
        genres: (data.genres ?? []).map((genre) => genre.name),
        vote_average: data.vote_average ?? 0,
        number_of_seasons: media_type === "tv" ? data.number_of_seasons ?? null : null,
      },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
