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

// POST /api/swipes/matches  body: { party_id: string }
export async function POST(req: Request) {
  const supabase = sb(req);

  // (Tentative) require sign-in. Comment these two lines out if you want it open during dev.
  //const { data: { user } } = await supabase.auth.getUser();
  //if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let party_id = "";
  try {
    const body = await req.json();
    party_id = (body?.party_id ?? "").trim();
  } catch {}
  if (!party_id) return NextResponse.json({ error: "party_id required" }, { status: 400 });

  // get current round_id (NEW)
  const { data: currentRound, error: roundErr } = await supabase
    .from("rounds")
    .select("round_id, round_num")
    .eq("party_id", party_id)
    .eq("is_active", true)
    .single();

  if (roundErr || !currentRound) {
    return NextResponse.json({ error: "no active round for this party" }, { status: 400 });
  }
  const round_id = currentRound.round_id;

  // How many members are in this party?
  const mc = await supabase
    .from("party_members")
    .select("user_id", { count: "exact", head: true })
    .eq("party_id", party_id);
  const memberCount = mc.count ?? 0;

  // Get all likes for this party
  const { data: likes, error: likeErr } = await supabase
    .from("swipes")
    .select("user_id, tmdb_id, media_type, title, poster_path, decision")
    .eq("party_id", party_id)
    .eq("decision", "like")
    .eq("round_id", round_id); // now only retrieves likes in the party for that round (NEW)

  if (likeErr) return NextResponse.json({ error: likeErr.message }, { status: 400 });

  // Group in memory: each title liked by how many distinct users?
  const map = new Map<
    string,
    { tmdb_id: number; media_type: "movie" | "tv"; title: string; poster_path: string | null; users: Set<string> }
  >();

  for (const r of likes ?? []) {
    const key = `${r.media_type}:${r.tmdb_id}`;
    if (!map.has(key)) {
      map.set(key, {
        tmdb_id: r.tmdb_id!,
        media_type: r.media_type as "movie" | "tv",
        title: r.title!,
        poster_path: r.poster_path ?? null,
        users: new Set<string>(),
      });
    }
    map.get(key)!.users.add(r.user_id!);
  }

  const matches = Array.from(map.values())
    .filter(x => x.users.size === memberCount) // everyone liked it
    .map(x => ({
      tmdb_id: x.tmdb_id,
      media_type: x.media_type,
      title: x.title,
      poster_path: x.poster_path,
      like_count: x.users.size,
      round_id, // NEW
      round_num: currentRound.round_num, // NEW
    }));

  return NextResponse.json({ matches, round_id, round_num: currentRound.round_num, }); // return matches and round number (NEW)
}
