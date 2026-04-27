// app/_lib/partyApi.ts
"use client";
import { supabase } from "@/app/_lib/supabaseClient";

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

export async function createParty(opts?: {
  name?: string;
  movieCount?: number;
}) {
  const res = await fetch("/api/party", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(opts ?? {}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok:boolean; party_id:string; invite_code:string }>;
}

export async function joinParty(invite_code: string) {
  const res = await fetch("/api/party/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ invite_code }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ party_id:string }>;
}
