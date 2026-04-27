import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

  return movies.slice(0, count).map((m) => ({
    tmdb_id: m.id,
    media_type: "movie" as const,
    title: m.title ?? m.name ?? "Untitled",
    poster_path: m.poster_path ?? null,
  }));
}

export async function POST(req: Request) {
  const supabase = sbAdmin();

  const { party_id, round_id } = await req.json();

  if (!party_id || !round_id) {
    return NextResponse.json(
      { ok: false, error: "party_id and round_id are required" },
      { status: 400 }
    );
  }

  // Load party row (must be in results to advance)
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .select("id, current_round_num, session_state")
    .eq("id", party_id)
    .maybeSingle();

  if (partyErr || !partyRow) {
    return NextResponse.json(
      { ok: false, error: partyErr?.message ?? "party not found" },
      { status: 400 }
    );
  }

  if (partyRow.session_state !== "results") {
    return NextResponse.json({ ok: true, skipped: true, reason: "not_in_results" });
  }

  const nextRoundNum = (partyRow.current_round_num ?? 1) + 1;

  // Create or reuse next round
  const { data: existingRound, error: existErr } = await supabase
    .from("rounds")
    .select("*")
    .eq("party_id", party_id)
    .eq("round_num", nextRoundNum)
    .maybeSingle();

  if (existErr) {
    return NextResponse.json({ ok: false, error: existErr.message }, { status: 400 });
  }

  let newRound = existingRound;

  if (!newRound) {
    const { data: created, error: createErr } = await supabase
      .from("rounds")
      .insert({ party_id, round_num: nextRoundNum, is_active: true })
      .select("*")
      .single();

    if (createErr || !created) {
      return NextResponse.json(
        { ok: false, error: createErr?.message ?? "could not create next round" },
        { status: 400 }
      );
    }

    newRound = created;

    // seed candidates from previous round matches, else random
    const { data: matchRows, error: matchErr } = await supabase
      .from("party_candidates")
      .select("tmdb_id, media_type, title, poster_path")
      .eq("party_id", party_id)
      .eq("round_id", round_id)
      .eq("is_match", true);

    if (matchErr) {
      return NextResponse.json({ ok: false, error: matchErr.message }, { status: 400 });
    }

    let candidateRows:
      | { tmdb_id: number; media_type: "movie" | "tv"; title: string; poster_path: string | null }[]
      | null = null;

    if (matchRows && matchRows.length > 0) {
      candidateRows = matchRows.map((m) => ({
        tmdb_id: m.tmdb_id,
        media_type: m.media_type as "movie" | "tv",
        title: m.title,
        poster_path: m.poster_path,
      }));
    } else {
      candidateRows = await fetchRandomMovies(10);
    }

    const { error: candErr } = await supabase.from("party_candidates").insert(
      candidateRows.map((c) => ({
        party_id,
        round_id: newRound!.round_id,
        tmdb_id: c.tmdb_id,
        media_type: c.media_type,
        title: c.title,
        poster_path: c.poster_path,
        is_match: false,
      }))
    );

    if (candErr) {
      return NextResponse.json({ ok: false, error: candErr.message }, { status: 400 });
    }
  }

  // Deactivate the previous round (safe if already inactive)
  await supabase.from("rounds").update({ is_active: false }).eq("round_id", round_id);

  // Flip party back to in_progress + increment round num
  const { error: partyUpdateErr } = await supabase
    .from("parties")
    .update({
      current_round_num: nextRoundNum,
      session_state: "in_progress",
      results_started_at: null,
    })
    .eq("id", party_id)
    .eq("session_state", "results");

  if (partyUpdateErr) {
    return NextResponse.json({ ok: false, error: partyUpdateErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, new_round: newRound });
}