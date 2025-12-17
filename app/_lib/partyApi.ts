"use client";
import { createClient } from "@supabase/supabase-js";

async function authHeader() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

export type PartyCreateFilters = {
  decade?: { start: number; end: number }; // e.g. { start: 1990, end: 1999 }
  genreIds?: number[]; // TMDB genre IDs
  runtimeMin?: number; // minutes
  runtimeMax?: number; // minutes
};

export type CreatePartyOptions = {
  name?: string;
  movieCount?: number;

  // Streaming filter (TMDB "watch providers")
  watchRegion?: string; // e.g. "US"
  providerIds?: number[]; // e.g. [8, 15] etc.

  filters?: PartyCreateFilters;
};

export async function createParty(opts?: CreatePartyOptions) {
  const res = await fetch("/api/party", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(opts ?? {}),
  });

  if (!res.ok) throw new Error(await res.text());

  return res.json() as Promise<{
    ok: boolean;
    party_id: string;
    invite_code: string;
  }>;
}

export async function joinParty(invite_code: string) {
  const res = await fetch("/api/party/join", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ invite_code }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ party_id: string }>;
}
