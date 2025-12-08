import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/*
  Returns whether the current round is complete (bool); all party members have finished swiping
  Also indicates if the session is finished (only one movie remains) and returns the winning movie if so.
*/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const party_id = searchParams.get("party_id");
  const round_id = searchParams.get("round_id"); 

  if (!party_id || !round_id) {
    return NextResponse.json(
      { ok: false, error: "Invalid party_id and round_id" }, { status: 400 });
  }

  // count of members
  const { data: members, error: memberErr } = await supabase
    .from("party_members")
    .select("user_id")
    .eq("party_id", party_id);

  if (memberErr) {
    return NextResponse.json({ ok: false, error: "party_members Error" }, { status: 400 });
  }
  const memberCount = members?.length ?? 0;

  // count of movies
  const { data: movies, error: movieErr } = await supabase
    .from("party_candidates")
    .select("tmdb_id")
    .eq("round_id", round_id);

  if (movieErr) {
    return NextResponse.json( { ok: false, error: "party_candidates Error" }, { status: 400 });
  }
  const movieCount = movies?.length ?? 0;

  // checks for whether the session is finished (only one movie remains)
  if (movieCount === 1) {
    return NextResponse.json({
      ok: true,
      isRoundComplete: true,     // round is complete since session is finished
      isSessionFinished: true,   // session is finished (no more rounds)
      winner: movies[0]          // return the remaining/winner movie
    });
  }

  // num of current swipes
  const { data: swipes, error: swipeErr } = await supabase
    .from("swipes")
    .select("user_id")
    .eq("round_id", round_id)
    .eq("party_id", party_id);

  if (swipeErr) {
    return NextResponse.json({ ok: false, error: "Swipes Error" }, { status: 400 });
  }
  const swipeCount = swipes?.length ?? 0;

  const expectedSwipes = memberCount * movieCount;
  const isRoundComplete = swipeCount >= expectedSwipes;

  return NextResponse.json({ok: true, isRoundComplete});
}