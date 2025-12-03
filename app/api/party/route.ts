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

async function fetchRandomMovies(count: number) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  const movies: any[] = [];

  while (movies.length < count) {
    // pick a random page of popular movies (1–50 is safe enough)
    const page = Math.floor(Math.random() * 50) + 1;

    const res = await fetch(
      `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TMDB error: ${res.status} ${text}`);
    }

    const data = await res.json();
    for (const m of data.results ?? []) {
      movies.push(m);
      if (movies.length >= count) break;
    }
  }

  // map to our candidate shape
  return movies.slice(0, count).map((m) => ({
    tmdb_id: m.id,
    media_type: "movie" as const,
    title: m.title ?? m.name ?? "Untitled",
    poster_path: m.poster_path ?? null,
  }));
}

export async function POST(req: Request) {
  const supabase = sb(req);

  const { data: { user } } = await supabase.auth.getUser();
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
  const movieCount = Number(body?.movieCount) || 10; // default 10 movies at a time per round

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
    .insert({
      party_id: party.id,
      user_id: user.id,
      role: "host",
    });

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message },
      { status: 400 }
    );
  }

  // 3) fetch random movies from TMDB and seed party_candidates
  try {
    const candidates = await fetchRandomMovies(movieCount);
    const rows = candidates.map((c) => ({
      party_id: party.id,
      tmdb_id: c.tmdb_id,
      media_type: c.media_type,
      title: c.title,
      poster_path: c.poster_path,
    }));

    const { error: candErr } = await supabase
      .from("party_candidates")
      .insert(rows);

    if (candErr) {
      return NextResponse.json(
        { ok: false, error: candErr.message },
        { status: 400 }
      );
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
