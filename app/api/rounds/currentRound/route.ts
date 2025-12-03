import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/*
  Used to retrieve the current round within a session
*/

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const party_id = searchParams.get("party_id");

  // gets current/active round for party
  const { data: round, error: currentErr } = await supabase
    .from("rounds")
    .select("*")
    .eq("party_id", party_id)
    .eq("is_active", true)
    .single();

  if (currentErr || !round) {
    return NextResponse.json({ ok: false, error: currentErr }, { status: 404 });
  }

  return NextResponse.json({ ok: true, round });
}