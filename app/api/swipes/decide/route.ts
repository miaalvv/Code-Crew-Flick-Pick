// app/api/swipes/decide/route.ts
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

export async function POST(req: Request) {
  const supabase = sb(req);

  // who is this user?
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // what did they swipe?
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const {
    party_id,
    tmdb_id,
    media_type,
    title,
    poster_path,
    decision,
  } = body;

  if (!party_id || !tmdb_id || !media_type || !decision) {
    return NextResponse.json(
      { error: "party_id, tmdb_id, media_type, decision are required" },
      { status: 400 }
    );
  }

  // gets current round num (NEW)
  const { data: currentRound, error: roundErr } = await supabase
    .from("rounds")
    .select("round_id, round_num")
    .eq("party_id", party_id)
    .eq("is_active", true)
    .single();

  if (!currentRound || roundErr) {
    return NextResponse.json({ error: "no active round for this party" }, { status: 400 });
  }

  const round_id = currentRound.round_id;

  // upsert swipe (so re-swiping the same card just updates the decision)
  const { error: insErr } = await supabase
    .from("swipes")
    .upsert({
      party_id,
      user_id: user.id,
      tmdb_id,
      media_type,
      title,
      poster_path,
      decision,
      round_id, // NEW
    }, { onConflict: "party_id,user_id,tmdb_id,media_type" });

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 400 });
  }

  // ---- compute current party matches (movies liked by everyone) ----

  // how many members are in this party?
  const { count: memberCount } = await supabase
    .from("party_members")
    .select("user_id", { head: true, count: "exact" })
    .eq("party_id", party_id);

  const totalMembers = memberCount ?? 0;

  // all likes in this party
  const { data: likes, error: likeErr } = await supabase
    .from("swipes")
    .select("tmdb_id, media_type, title, poster_path, user_id, decision")
    .eq("party_id", party_id)
    .eq("decision", "like")
    .eq("round_id", round_id); // NEW

  if (likeErr) {
    return NextResponse.json({ error: likeErr.message }, { status: 400 });
  }

  // group likes per movie + count distinct users
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

  const matches = Array.from(map.values())
    .filter((m) => totalMembers > 0 && m.users.size === totalMembers)
    .map((m) => ({
      tmdb_id: m.tmdb_id,
      media_type: m.media_type,
      title: m.title,
      poster_path: m.poster_path,
      like_count: m.users.size,
    }));

  // moves matches into party_candidates (NEW)
  if (matches.length > 0) {
    const { error: candidateErr } = await supabase
      .from("party_candidates")
      .upsert(
        matches.map(m => ({
          party_id,
          tmdb_id: m.tmdb_id,
          media_type: m.media_type,
          title: m.title,
          poster_path: m.poster_path,
          round_id: round_id,
          is_match: true,        
        })),
        { onConflict: "party_id, round_id, tmdb_id, media_type" }
      );

    if (candidateErr) {
      return NextResponse.json({ error: "could not store matches into party_candidates" }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true, matches });
}
