import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/*
  Sets previous round results as new pool for members to choose from. 
  Deactivates previous round and activates new round.
*/

export async function POST(req: Request) {
  const { party_id, round_id } = await req.json();

  if (!party_id || !round_id) {
    return NextResponse.json({ ok: false, error: "Invalid party_id and round_id" }, { status: 400 });
  }

  // movies that will be going into the next round
  const { data: prevResults, error: prevErr } = await supabase
    .from("party_candidates")
    .select("tmdb_id, media_type, title, poster_path")
    .eq("round_id", round_id)
    .eq("party_id", party_id)
    .eq("is_match", true);

  if (prevErr || !prevResults?.length) {
    return NextResponse.json({ ok: false, error: "No previous results" }, { status: 400 });
  }
  
  // deactivates previous round
  await supabase
    .from("rounds")
    .update({ is_active: false })
    .eq("round_id", round_id);

  // current round num to increment
  const { data: currentRound } = await supabase
    .from("rounds")
    .select("round_num")
    .eq("round_id", round_id)
    .single();

  const nextRoundNum = (currentRound?.round_num ?? 1) + 1;

  // new round
  const { data: newRound, error: insertErr } = await supabase
    .from("rounds")
    .insert({
      party_id,
      round_num: nextRoundNum,
      is_active: true
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ ok: false, error: insertErr }, { status: 500 });
  }
  
  const nextRoundId = newRound.round_id;
  const nextRoundData = prevResults.map((r) => ({
    party_id,
    round_id: nextRoundId,
    tmdb_id: r.tmdb_id,
    media_type: r.media_type,
    title: r.title,
    poster_path: r.poster_path,
    is_match: false,
  }));

  // new round’s movie pool = previous results
  const { error: newErr } = await supabase
    .from("party_candidates")
    .insert(nextRoundData);

  if (newErr) {
    return NextResponse.json({ ok: false, error: newErr }, { status: 500 });
  }

  return NextResponse.json({ ok: true, new_round: newRound });
}