// app/api/rounds/nextRound/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// you can DRY this up by importing from party route later,
// but for now it’s fine to duplicate.
async function fetchRandomMovies(count: number) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  const movies: any[] = [];

  while (movies.length < count) {
    const page = Math.floor(Math.random() * 50) + 1;

    const res = await fetch(
      `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      },
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

  return movies.slice(0, count).map((m) => ({
    tmdb_id: m.id,
    media_type: "movie" as const,
    title: m.title ?? m.name ?? "Untitled",
    poster_path: m.poster_path ?? null,
  }));
}

export async function POST(req: Request) {
  const supabase = sb();

  const { party_id, round_id } = await req.json();

  if (!party_id || !round_id) {
    return NextResponse.json(
      { ok: false, error: "party_id and round_id are required" },
      { status: 400 },
    );
  }

  // 1) get party row & current_round_num
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .select("id, current_round_num")
    .eq("id", party_id)
    .single();

  if (partyErr || !partyRow) {
    return NextResponse.json(
      { ok: false, error: partyErr?.message ?? "party not found" },
      { status: 400 },
    );
  }

  const nextRoundNum = (partyRow.current_round_num ?? 1) + 1;

  // 2) create next round row
  const { data: newRound, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      party_id,
      round_num: nextRoundNum,
      is_active: true,
    })
    .select("*")
    .single();

  if (roundErr || !newRound) {
    return NextResponse.json(
      { ok: false, error: roundErr?.message ?? "could not create next round" },
      { status: 400 },
    );
  }

  const new_round_id = newRound.round_id;

  // 3) decide what candidates to seed
  //    First, try to use matches from the previous round
  const { data: matchRows, error: matchErr } = await supabase
    .from("party_candidates")
    .select("tmdb_id, media_type, title, poster_path, is_match")
    .eq("party_id", party_id)
    .eq("round_id", round_id)
    .eq("is_match", true);

  if (matchErr) {
    return NextResponse.json(
      { ok: false, error: matchErr.message },
      { status: 400 },
    );
  }

  let candidateRows: {
    tmdb_id: number;
    media_type: "movie" | "tv";
    title: string;
    poster_path: string | null;
  }[] = [];

  if (matchRows && matchRows.length > 0) {
    // Use previous-round matches as the new pool
    candidateRows = matchRows.map((m) => ({
      tmdb_id: m.tmdb_id,
      media_type: m.media_type as "movie" | "tv",
      title: m.title,
      poster_path: m.poster_path,
    }));
  } else {
    // No matches - everyone skipped everything so we pull fresh random movies
    candidateRows = await fetchRandomMovies(10);
  }

  // 4) insert candidates for the new round
  const { error: candErr } = await supabase.from("party_candidates").insert(
    candidateRows.map((c) => ({
      party_id,
      round_id: new_round_id,
      tmdb_id: c.tmdb_id,
      media_type: c.media_type,
      title: c.title,
      poster_path: c.poster_path,
      is_match: false,
    })),
  );

  if (candErr) {
    return NextResponse.json(
      { ok: false, error: candErr.message },
      { status: 400 },
    );
  }

  // 5) update party.current_round_num
  await supabase
    .from("parties")
    .update({ current_round_num: nextRoundNum })
    .eq("id", party_id);

  return NextResponse.json({
    ok: true,
    new_round: newRound,
  });
}