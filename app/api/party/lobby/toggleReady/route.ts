// app/api/party/lobby/toggleReady/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Body = {
  party_id: string;
  ready: boolean;
};

function getBearerToken(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function POST(req: Request) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ ok: false, error: "Missing bearer token" }, { status: 401 });
    }

    const body = (await req.json()) as Partial<Body>;
    const party_id = body.party_id ?? "";
    const ready = Boolean(body.ready);

    if (!party_id) {
      return NextResponse.json({ ok: false, error: "Missing party_id" }, { status: 400 });
    }

    // 1) Verify the user using the provided access token (anon client)
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const { data: userRes, error: userErr } = await anon.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
    }

    const user_id = userRes.user.id;

    // 2) Use service role to update party_lobby (bypasses RLS safely on server)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Optional safety: ensure user is a party member before allowing update
    const { data: memberRow, error: memberErr } = await admin
      .from("party_members")
      .select("user_id")
      .eq("party_id", party_id)
      .eq("user_id", user_id)
      .maybeSingle();

    if (memberErr || !memberRow) {
      return NextResponse.json({ ok: false, error: "Not a party member" }, { status: 403 });
    }

    // 3) Update readiness
    const { error: updErr } = await admin
      .from("party_lobby")
      .update({ is_ready: ready })
      .eq("party_id", party_id)
      .eq("user_id", user_id);

    if (updErr) {
      return NextResponse.json({ ok: false, error: updErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}