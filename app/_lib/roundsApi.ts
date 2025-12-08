"use client";
import { createClient } from "@supabase/supabase-js";

async function authHeader() {
    const sb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { session } } = await sb.auth.getSession();
    if (!session?.access_token) {
        throw new Error("Not signed in");
    }
    return {
        Authorization: `Bearer ${session.access_token}`
    };
}

// Fetches the current round number for a given party
export async function getCurrentRound(party_id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/rounds/currentRound?party_id=${party_id}`, {
        method: "GET",
        headers,
    });
    if (!res.ok) {
        throw new Error(`Error fetching current round: ${res.statusText}`);
    }
    return res.json(); // can access .round_num
}

// Verifies whether a round is complete and ends session if finished
export async function completeRound(party_id: string, round_id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/rounds/completeRound`, {
        method: "POST",
        headers,
        body: JSON.stringify({ party_id, round_id }),
    });
    if (!res.ok) {
        throw new Error(`completeRound failed: ${res.statusText}`);
    }
    return res.json(); // can access .isRoundComplete, isSessionFinished, .winner
}

// Advances session to the next round
export async function nextRound(party_id: string, round_id: string) {
    const headers = await authHeader();
    const res = await fetch(`/api/rounds/nextRound`, {
        method: "POST",
        headers,
        body: JSON.stringify({ party_id, round_id }),
    });
    if (!res.ok) {
        throw new Error(`nextRound failed: ${res.statusText}`);
    }
    return res.json(); 
}