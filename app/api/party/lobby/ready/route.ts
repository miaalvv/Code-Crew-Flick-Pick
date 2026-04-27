// app/api/party/lobby/ready/route.ts
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
  const is_ready = !!body?.is_ready;

  if (!party_id) return NextResponse.json({ ok: false, error: "party_id is required" }, { status: 400 });

  const { error } = await supabase
    .from("party_lobby")
    .upsert({ party_id, user_id: user.id, is_ready });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, is_ready });
}
