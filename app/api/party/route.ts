// app/api/party/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: auth } } }
  );
}

type PartyCreateFilters = {
  decade?: { start: number; end: number };
  genreIds?: number[];
  runtimeMin?: number;
  runtimeMax?: number;
};

type DiscoverOpts = {
  count: number;
  watchRegion?: string;
  providerIds?: number[];
  filters?: PartyCreateFilters;
};

async function fetchMoviesWithFilters(opts: DiscoverOpts) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  const movies: any[] = [];
  const count = Math.max(1, Math.min(50, Math.floor(opts.count || 10)));

  // build base query params
  const base = new URLSearchParams();
  base.set("include_adult", "false");
  base.set("include_video", "false");
  base.set("language", "en-US");
  base.set("sort_by", "popularity.desc");

  // decade -> release date range
  const decade = opts.filters?.decade;
  if (decade?.start && decade?.end) {
    base.set("primary_release_date.gte", `${decade.start}-01-01`);
    base.set("primary_release_date.lte", `${decade.end}-12-31`);
  }

  // runtime range
  const rMin = opts.filters?.runtimeMin;
  const rMax = opts.filters?.runtimeMax;
  if (typeof rMin === "number" && Number.isFinite(rMin) && rMin > 0) {
    base.set("with_runtime.gte", String(Math.floor(rMin)));
  }
  if (typeof rMax === "number" && Number.isFinite(rMax) && rMax > 0) {
    base.set("with_runtime.lte", String(Math.floor(rMax)));
  }

  // genres (OR them via pipe, so selecting multiple genres expands results)
  const genreIds = (opts.filters?.genreIds ?? []).filter((n) => Number.isFinite(n));
  if (genreIds.length > 0) {
    base.set("with_genres", genreIds.join("|"));
  }

  // provider filtering (streaming / flatrate) in region
  const watchRegion = (opts.watchRegion || "US").toUpperCase();
  const providerIds = (opts.providerIds ?? []).filter((n) => Number.isFinite(n));
  if (providerIds.length > 0) {
    base.set("watch_region", watchRegion);
    base.set("with_watch_monetization_types", "flatrate");
    base.set("with_watch_providers", providerIds.join("|")); // OR list
  }

  // keep grabbing random pages until we have enough unique movies
  // (TMDB discover returns 20 per page)
  const seen = new Set<number>();
  let attempts = 0;

  while (movies.length < count && attempts < 12) {
    attempts += 1;

    // random page 1..50
    const page = Math.floor(Math.random() * 50) + 1;

    const url = new URL("https://api.themoviedb.org/3/discover/movie");
    const params = new URLSearchParams(base);
    params.set("page", String(page));
    url.search = params.toString();

    const res = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`TMDB discover failed (${res.status}): ${txt}`);
    }

    const data = await res.json();
    const results: any[] = data?.results ?? [];

    for (const m of results) {
      if (!m?.id || seen.has(m.id)) continue;
      seen.add(m.id);

      movies.push({
        tmdb_id: m.id,
        media_type: "movie" as const,
        title: m.title ?? m.name ?? "Untitled",
        poster_path: m.poster_path ?? null,
      });

      if (movies.length >= count) break;
    }
  }

  // If filters are super strict, we might come up short:
  if (movies.length === 0) {
    throw new Error("No movies found with those filters. Try loosening filters.");
  }

  return movies.slice(0, count);
}

export async function POST(req: Request) {
  const supabase = sb(req);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const name = (body?.name ?? "Movie Night").toString();
  const movieCount = Number(body?.movieCount) || 10;

  const watchRegion = (body?.watchRegion ?? "US").toString();
  const providerIds = Array.isArray(body?.providerIds) ? body.providerIds.map(Number) : [];

  const filters: PartyCreateFilters | undefined = body?.filters
    ? {
        decade: body.filters.decade?.start && body.filters.decade?.end
          ? { start: Number(body.filters.decade.start), end: Number(body.filters.decade.end) }
          : undefined,
        genreIds: Array.isArray(body.filters.genreIds) ? body.filters.genreIds.map(Number) : [],
        runtimeMin: body.filters.runtimeMin != null ? Number(body.filters.runtimeMin) : undefined,
        runtimeMax: body.filters.runtimeMax != null ? Number(body.filters.runtimeMax) : undefined,
      }
    : undefined;

  // 1) create party
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .insert({ name })
    .select()
    .single();

  if (partyErr || !partyRow) {
    return NextResponse.json(
      { ok: false, error: partyErr?.message ?? "Failed to create party" },
      { status: 400 }
    );
  }

  const party = partyRow;

  // 2) add creator as host in party_members
  const { error: memberErr } = await supabase
    .from("party_members")
    .insert({ party_id: party.id, user_id: user.id, role: "host" });

  if (memberErr) {
    return NextResponse.json({ ok: false, error: memberErr.message }, { status: 400 });
  }

  // 3) initialize round 1
  const { data: roundRow, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      party_id: party.id,
      round_num: 1,
      is_active: true,
    })
    .select()
    .single();

  if (roundErr || !roundRow) {
    return NextResponse.json({ ok: false, error: "failed to create Round 1" }, { status: 400 });
  }
  const round_id = roundRow.round_id;

  // 4) fetch filtered movies from TMDB and seed party_candidates
  try {
    const candidates = await fetchMoviesWithFilters({
      count: movieCount,
      watchRegion,
      providerIds,
      filters,
    });

    const rows = candidates.map((c) => ({
      party_id: party.id,
      tmdb_id: c.tmdb_id,
      media_type: c.media_type,
      title: c.title,
      poster_path: c.poster_path,
      round_id,
    }));

    const { error: candErr } = await supabase.from("party_candidates").insert(rows);

    if (candErr) {
      return NextResponse.json({ ok: false, error: candErr.message }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Error seeding TMDB movies:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to seed movies" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    party_id: party.id,
    invite_code: party.invite_code,
  });
}
