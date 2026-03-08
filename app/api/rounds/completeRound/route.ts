// app/api/rounds/completeRound/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = sb();

  const { party_id, round_id } = await req.json();

  if (!party_id || !round_id) {
    return NextResponse.json(
      { ok: false, error: "party_id and round_id are required" },
      { status: 400 }
    );
  }

  // 1) How many members are in this party?
  const { count: memberCount, error: memberErr } = await supabase
    .from("party_members")
    .select("user_id", { head: true, count: "exact" })
    .eq("party_id", party_id);

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message },
      { status: 400 }
    );
  }
  const totalMembers = memberCount ?? 0;

  // 2) How many candidates are in THIS ROUND?
  const { count: candidateCount, error: candErr } = await supabase
    .from("party_candidates")
    .select("tmdb_id", { head: true, count: "exact" })
    .eq("party_id", party_id)
    .eq("round_id", round_id);

  if (candErr) {
    return NextResponse.json(
      { ok: false, error: candErr.message },
      { status: 400 }
    );
  }
  const totalCandidates = candidateCount ?? 0;

  // 3) How many swipe rows exist for THIS ROUND?
  const { count: swipeCount, error: swipeErr } = await supabase
    .from("swipes")
    .select("tmdb_id", { head: true, count: "exact" })
    .eq("party_id", party_id)
    .eq("round_id", round_id);

  if (swipeErr) {
    return NextResponse.json(
      { ok: false, error: swipeErr.message },
      { status: 400 }
    );
  }
  const totalSwipes = swipeCount ?? 0;

  // A round is complete only if every member has swiped every candidate
  const isRoundComplete =
    totalMembers > 0 &&
    totalCandidates > 0 &&
    totalSwipes === totalMembers * totalCandidates;

  if (!isRoundComplete) {
    // NOT DONE YET, therefore do NOT deactivate the round
    return NextResponse.json({
      ok: true,
      isRoundComplete: false,
      isSessionFinished: false,
      winner: null,
    });
  }

  // 4) Round IS complete so see if entire SESSION is finished
  const { data: likes, error: likeErr } = await supabase
    .from("swipes")
    .select("tmdb_id, media_type, title, poster_path, user_id, decision")
    .eq("party_id", party_id)
    .eq("round_id", round_id)
    .eq("decision", "like");

  if (likeErr) {
    return NextResponse.json(
      { ok: false, error: likeErr.message },
      { status: 400 }
    );
  }

  const map = new Map<
    string,
    {
      tmdb_id: number;
      media_type: "movie" | "tv";
      title: string;
      poster_path: string | null;
      users: Set<string>;
    }
  >();

  for (const row of likes ?? []) {
    const key = `${row.media_type}:${row.tmdb_id}`;
    if (!map.has(key)) {
      map.set(key, {
        tmdb_id: row.tmdb_id!,
        media_type: row.media_type as "movie" | "tv",
        title: row.title!,
        poster_path: row.poster_path ?? null,
        users: new Set<string>(),
      });
    }
    map.get(key)!.users.add(row.user_id!);
  }

  const globalMatches = Array.from(map.values()).filter(
    (m) => totalMembers > 0 && m.users.size === totalMembers
  );

  let isSessionFinished = false;
  let winner: any = null;

  if (globalMatches.length === 1) {
    isSessionFinished = true;
    winner = globalMatches[0];
  }

  // Mark this round inactive now that it's truly complete
  await supabase
    .from("rounds")
    .update({ is_active: false })
    .eq("round_id", round_id);

  return NextResponse.json({
    ok: true,
    isRoundComplete: true,
    isSessionFinished,
    winner,
  });
}