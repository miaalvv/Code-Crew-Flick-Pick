// app/api/swipes/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** Build a Supabase client for this request, carrying the user's bearer token */
function supabaseForRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

/** Type of a "like" row returned from swipes */
type LikeRow = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  user_id: string;
  decision: "like" | "skip";
};

/** Item we aggregate likes into */
type ItemAgg = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  users: Set<string>;
};

export async function POST(req: Request) {
  const supabase = supabaseForRequest(req);
  const { party_id, tmdb_id, media_type, title, poster_path, decision } =
    await req.json();

  // auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // store swipe
  const { error: upsertErr } = await supabase.from("swipes").upsert({
    party_id,
    user_id: user.id,
    tmdb_id,
    media_type,
    title,
    poster_path,
    decision,
  });
  if (upsertErr) {
    return NextResponse.json({ ok: false, error: upsertErr }, { status: 400 });
  }

  // members count (for "liked by everyone")
  const { data: members } = await supabase
    .from("party_members")
    .select("user_id")
    .eq("party_id", party_id);
  const memberCount = members?.length ?? 0;

  // all likes in this party
  const { data: likes } = await supabase
    .from("swipes")
    .select("tmdb_id, media_type, title, poster_path, user_id, decision")
    .eq("party_id", party_id)
    .eq("decision", "like");

  const byItem = new Map<string, ItemAgg>();

  (likes as LikeRow[] | null ?? []).forEach((r) => {
    const key = `${r.media_type}:${r.tmdb_id}`;
    if (!byItem.has(key)) {
      byItem.set(key, {
        tmdb_id: r.tmdb_id,
        media_type: r.media_type,
        title: r.title,
        poster_path: r.poster_path,
        users: new Set<string>(),
      });
    }
    byItem.get(key)!.users.add(r.user_id);
  });

  const matches = Array.from(byItem.values()).filter(
    (x) => x.users.size === memberCount
  );

  return NextResponse.json({ ok: true, matches });
}
