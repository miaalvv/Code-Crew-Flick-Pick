import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseForRequest(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } }
  );
}

// simple code generator
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

export async function POST(req: Request) {
  const supabase = supabaseForRequest(req);
  const { action, name, invite_code } = await req.json();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  if (action === "create") {
    const party = { owner_id: user.id, name: name || "Movie Night", invite_code: code() };
    const { data, error } = await supabase.from("parties").insert(party).select("*").single();
    if (error) return NextResponse.json({ ok: false, error }, { status: 400 });
    await supabase.from("party_members").insert({ party_id: data.id, user_id: user.id, role: "owner" });
    return NextResponse.json({ ok: true, party: data });
  }

  if (action === "join") {
    const { data: found, error } = await supabase.from("parties").select("*").eq("invite_code", invite_code).maybeSingle();
    if (error || !found) return NextResponse.json({ ok: false, error: "invalid code" }, { status: 404 });
    await supabase.from("party_members").upsert({ party_id: found.id, user_id: user.id, role: "member" });
    return NextResponse.json({ ok: true, party: found });
  }

  return NextResponse.json({ ok: false, error: "bad request" }, { status: 400 });
}
