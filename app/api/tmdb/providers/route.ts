import { NextResponse } from "next/server";

type Provider = {
  provider_id: number;
  provider_name: string;
  logo_path: string | null;
  display_priority?: number;
};

type TMDBProvidersResponse = {
  results: Provider[];
};

function tmdb(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
    // server-only: do NOT expose TMDB_API_KEY to the client
    cache: "no-store",
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region") || "US";

    // movie providers (you can add tv providers similarly later)
    const res = await tmdb("/watch/providers/movie", {
      watch_region: region,
      language: "en-US",
    });

    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status }, { status: 500 });
    }

    const data: TMDBProvidersResponse = await res.json();
    const list = (data.results ?? [])
      // keep providers with a name
      .filter((p) => p.provider_name)
      // normalize/minify fields we care about
      .map((p) => ({
        id: p.provider_id,
        name: p.provider_name,
        logo_path: p.logo_path as string | null,
      }));

    return NextResponse.json({ ok: true, providers: list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
