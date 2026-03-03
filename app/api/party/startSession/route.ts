// app/api/party/startSession/route.ts
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
  const supabase = sb(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const party_id = (body?.party_id ?? "").trim();
  const movieCount = Number(body?.movieCount) || 10;

  if (!party_id) {
    return NextResponse.json({ ok: false, error: "party_id is required" }, { status: 400 });
  }

  // 1) verify requester is host
  const { data: pm, error: pmErr } = await supabase
    .from("party_members")
    .select("role")
    .eq("party_id", party_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (pmErr || !pm || pm.role !== "host") {
    return NextResponse.json({ ok: false, error: "only host can start session" }, { status: 403 });
  }

  // 2) read party row
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .select("id, session_state, current_round_num")
    .eq("id", party_id)
    .single();

  if (partyErr || !partyRow) {
    return NextResponse.json({ ok: false, error: partyErr?.message ?? "party not found" }, { status: 400 });
  }

  // 3) IMPORTANT: force-close any existing active rounds for this party
  // (prevents “JSON object requested…” + keeps your unique partial index happy)
  const { error: closeErr } = await supabase
    .from("rounds")
    .update({ is_active: false })
    .eq("party_id", party_id)
    .eq("is_active", true);

  if (closeErr) {
    return NextResponse.json({ ok: false, error: closeErr.message }, { status: 400 });
  }

  // 4) start next round number
  const nextRoundNum = (partyRow.current_round_num ?? 0) + 1;

  const { data: newRound, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      party_id,
      round_num: nextRoundNum,
      is_active: true,
    })
    .select()
    .single();

  if (roundErr || !newRound) {
    return NextResponse.json({ ok: false, error: roundErr?.message ?? "failed to create round" }, { status: 400 });
  }

  const round_id = newRound.round_id;

  // 5) seed candidates
  try {
    const candidates = await fetchRandomMovies(movieCount);
    const rows = candidates.map((c) => ({
      party_id,
      tmdb_id: c.tmdb_id,
      media_type: c.media_type,
      title: c.title,
      poster_path: c.poster_path,
      round_id,
      is_match: false,
    }));

    const { error: candErr } = await supabase
      .from("party_candidates")
      .insert(rows);

    if (candErr) {
      // rollback round
      await supabase.from("rounds").delete().eq("round_id", round_id);
      return NextResponse.json({ ok: false, error: candErr.message }, { status: 500 });
    }
  } catch (err: any) {
    await supabase.from("rounds").delete().eq("round_id", round_id);
    return NextResponse.json({ ok: false, error: err?.message ?? "failed to seed candidates" }, { status: 500 });
  }

  // 6) update party session state + current round num
  const { error: updErr } = await supabase
    .from("parties")
    .update({
      session_state: "in_progress",
      session_started_at: new Date().toISOString(),
      current_round_num: nextRoundNum,
    })
    .eq("id", party_id);

  if (updErr) {
    return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
  }

  // 7) clear lobby rows (optional)
  await supabase.from("party_lobby").delete().eq("party_id", party_id);

  return NextResponse.json({ ok: true, newRound });
}
