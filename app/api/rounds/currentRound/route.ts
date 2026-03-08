// app/api/rounds/currentRound/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = sb();

  const { party_id } = await req.json();
  if (!party_id) {
    return NextResponse.json(
      { ok: false, error: "party_id is required" },
      { status: 400 }
    );
  }

  const { data: round, error } = await supabase
    .from("rounds")
    .select("round_id, party_id, round_num, is_active")
    .eq("party_id", party_id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, round: null },
      { status: 400 }
    );
  }

  // ok:true even if round is null; frontend decides what to do
  return NextResponse.json({ ok: true, round: round ?? null });
}