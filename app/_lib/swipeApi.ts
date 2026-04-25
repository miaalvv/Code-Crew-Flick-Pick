// app/_lib/swipeApi.ts
"use client";
import { createClient } from "@supabase/supabase-js";

async function authHeader() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.access_token) throw new Error("Not signed in");
  return { Authorization: `Bearer ${session.access_token}` };
}

export type Candidate = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
};

export async function getNextCard(party_id: string) {
  const res = await fetch("/api/swipes/next", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ party_id }),
  });

  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data?.error || "Failed to load next card");
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data as { next: Candidate | null };
}

export async function sendSwipe(input: {
  party_id: string;
  round_id?: string | null; // pass from client to avoid active-round race
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  decision: "like" | "skip";
}) {
  const res = await fetch("/api/swipes/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify(input),
  });

  const data = await res.json();
  if (!res.ok) {
    const err: any = new Error(data?.error || "Failed to submit swipe");
    err.status = res.status;  // lets UI handle 409 gracefully
    err.payload = data;       // optional (handy for debugging)
    throw err;
  }

  return data;
}