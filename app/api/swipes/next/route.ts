// app/api/swipes/next/route.ts
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

  // who is this?
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // which party?
  let party_id = "";
  try {
    const body = await req.json();
    party_id = (body?.party_id ?? "").trim();
  } catch {
    // ignore, handled below
  }
  if (!party_id) {
    return NextResponse.json({ error: "party_id required" }, { status: 400 });
  }

  // 1) movies this user has already swiped in this party
  const { data: seenRows, error: seenErr } = await supabase
    .from("swipes")
    .select("tmdb_id, media_type")
    .eq("party_id", party_id)
    .eq("user_id", user.id);

  if (seenErr) {
    return NextResponse.json({ error: seenErr.message }, { status: 400 });
  }

  const seen = new Set(
    (seenRows ?? []).map((r) => `${r.media_type}:${r.tmdb_id}`)
  );

  // 2) full candidate pool for this party
  const { data: pool, error: poolErr } = await supabase
    .from("party_candidates")
    .select("tmdb_id, media_type, title, poster_path")
    .eq("party_id", party_id);

  if (poolErr) {
    return NextResponse.json({ error: poolErr.message }, { status: 400 });
  }

  const candidates = pool ?? [];

  // 3) pick first unseen (or random unseen)
  const unseen = candidates.filter(
    (c) => !seen.has(`${c.media_type}:${c.tmdb_id}`)
  );
  const next = unseen.length
    ? unseen[Math.floor(Math.random() * unseen.length)]
    : null;

  // debug log in your dev server terminal
  console.log("[/api/swipes/next]", {
    user_id: user.id,
    party_id,
    pool: candidates.length,
    seen: seenRows?.length ?? 0,
    next: next ? `${next.media_type}:${next.tmdb_id}` : null,
  });

  return NextResponse.json({ next });
}
