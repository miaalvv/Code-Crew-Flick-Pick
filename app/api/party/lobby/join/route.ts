// app/api/party/lobby/join/route.ts
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const party_id = (body?.party_id ?? "").trim();
  if (!party_id) return NextResponse.json({ ok: false, error: "party_id is required" }, { status: 400 });

  // Upsert into lobby
  const { error: lobbyErr } = await supabase
    .from("party_lobby")
    .upsert({ party_id, user_id: user.id, is_ready: false });

  if (lobbyErr) {
    return NextResponse.json({ ok: false, error: lobbyErr.message }, { status: 400 });
  }

  // Ensure party_members row exists (ignore duplicate)
  const { error: memErr } = await supabase
    .from("party_members")
    .insert({ party_id, user_id: user.id, role: "member" });

  if (memErr && !/duplicate key/i.test(memErr.message)) {
    return NextResponse.json({ ok: false, error: memErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, party_id });
}
