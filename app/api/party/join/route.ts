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

/**
 * POST /api/party/join
 * body: { invite_code: string }
 * returns: { party_id: string }
 */
export async function POST(req: Request) {
  const supabase = sb(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch {}
  const invite_code = (body?.invite_code ?? "").trim();
  if (!invite_code) return NextResponse.json({ error: "invite_code required" }, { status: 400 });

  // find party by invite code
  const { data: party, error: findErr } = await supabase
    .from("parties")
    .select("id")
    .eq("invite_code", invite_code)
    .single();

  if (findErr || !party) {
    return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
  }

  // add membership (ignore if already exists)
  const { error: memErr } = await supabase
    .from("party_members")
    .insert({ party_id: party.id, user_id: user.id, role: "member" });

  // if you have a unique constraint (party_id, user_id) memErr may be "duplicate key" – ignore it
  if (memErr && !/duplicate key/i.test(memErr.message)) {
    return NextResponse.json({ error: memErr.message }, { status: 400 });
  }

  return NextResponse.json({ party_id: party.id });
}
