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

  // pick the most recent active round (if any). Use maybeSingle() so we don't throw
  const { data: round, error } = await supabase
    .from("rounds")
    .select("round_id, round_num, is_active")
    .eq("party_id", party_id)
    .eq("is_active", true)
    .order("round_num", { ascending: false }) // prefer the highest round_num if multiples
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, round });
}
