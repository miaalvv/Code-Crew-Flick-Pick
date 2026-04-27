// app/api/swipes/matches/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Server-side privileged client (bypasses RLS)
function sbAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/swipes/matches
// body: { party_id: string, round_id?: string }
export async function POST(req: Request) {
  const supabase = sbAdmin();

  let party_id = "";
  let round_id = "";

  try {
    const body = await req.json();
    party_id = (body?.party_id ?? "").trim();
    round_id = (body?.round_id ?? "").trim();
  } catch {}

  if (!party_id) {
    return NextResponse.json({ error: "party_id required" }, { status: 400 });
  }

  // If round_id not provided, fall back to latest round (active or not)
  if (!round_id) {
    const { data: latestRound, error: latestErr } = await supabase
      .from("rounds")
      .select("round_id")
      .eq("party_id", party_id)
      .order("round_num", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestErr) {
      return NextResponse.json({ error: latestErr.message }, { status: 400 });
    }
    if (!latestRound) return NextResponse.json({ matches: [] });

    round_id = latestRound.round_id;
  }

  // Count members (admin bypasses RLS → this will be correct)
  const { count: memberCount, error: memberErr } = await supabase
    .from("party_members")
    .select("user_id", { count: "exact", head: true })
    .eq("party_id", party_id);

  if (memberErr) {
    return NextResponse.json({ error: memberErr.message }, { status: 400 });
  }

  const totalMembers = memberCount ?? 0;
  if (totalMembers <= 0) return NextResponse.json({ matches: [] });

  // Likes for this round
  const { data: likes, error: likeErr } = await supabase
    .from("swipes")
    .select("user_id, tmdb_id, media_type, title, poster_path")
    .eq("party_id", party_id)
    .eq("round_id", round_id)
    .eq("decision", "like");

  if (likeErr) {
    return NextResponse.json({ error: likeErr.message }, { status: 400 });
  }

  // Count distinct users per title
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
    .filter((x) => x.users.size === totalMembers)
    .map((x) => ({
      tmdb_id: x.tmdb_id,
      media_type: x.media_type,
      title: x.title,
      poster_path: x.poster_path,
      like_count: x.users.size,
    }));

  return NextResponse.json({ matches });
}