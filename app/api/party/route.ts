// app/api/party/route.ts

// reverted back to route.ts file from lobby-rounds-realtime-clean branch, 
//    in order to remove fetching movie pool at the start party creation
//    and moved movie fetching into startSession, so movies are fetched once everyone is in the party, 
//    and everyone's preference will be taken into account.

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
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const name = (body?.name ?? "Movie Night").toString();

  // 1) create party in "lobby" state, with 0 rounds started
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .insert({
      name,
      session_state: "lobby",
      current_round_num: 0,
      owner_id: user.id,      // optional
      created_by: user.id,    // optional
    })
    .select()
    .single();

  if (partyErr || !partyRow) {
    return NextResponse.json(
      { ok: false, error: partyErr?.message ?? "Failed to create party" },
      { status: 400 }
    );
  }

  // 2) add creator as host
  const { error: memberErr } = await supabase
    .from("party_members")
    .insert({
      party_id: partyRow.id,
      user_id: user.id,
      role: "host",
    });

  if (memberErr) {
    return NextResponse.json({ ok: false, error: memberErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    party_id: partyRow.id,
    invite_code: partyRow.invite_code,
  });
}