// app/party/results/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabase as globalSupabase } from "@/app/_lib/supabaseClient";

const supabase =
  globalSupabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  like_count: number;
};

type PartyRow = {
  session_state: string | null;
  results_started_at: string | null;
  current_round_num: number | null;
};

export default function PartyResults() {
  const params = useSearchParams();
  const router = useRouter();

  const party_id = params.get("party") ?? "";
  const roundParam = params.get("round") ?? "";

  const [matches, setMatches] = useState<Match[]>([]);
  const [party, setParty] = useState<PartyRow | null>(null);
  const [roundId, setRoundId] = useState<string | null>(roundParam || null);
  const [isHost, setIsHost] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const durationSeconds = 30;

  const secondsLeft = useMemo(() => {
    const started = party?.results_started_at;
    if (!started) return durationSeconds;
    const startedMs = new Date(started).getTime();
    const elapsed = (now - startedMs) / 1000;
    return Math.max(0, Math.ceil(durationSeconds - elapsed));
  }, [party?.results_started_at, now]);

  // Load party + host
  useEffect(() => {
    if (!party_id) return;

    (async () => {
      const { data: partyRow } = await supabase
        .from("parties")
        .select("session_state, results_started_at, current_round_num")
        .eq("id", party_id)
        .maybeSingle();

      setParty(partyRow ?? null);

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;

      const { data: pm } = await supabase
        .from("party_members")
        .select("role")
        .eq("party_id", party_id)
        .eq("user_id", uid)
        .maybeSingle();

      setIsHost(pm?.role === "host");
    })();
  }, [party_id]);

  // Fetch matches (now using round_id!)
  useEffect(() => {
    if (!party_id || !roundId) return;

    (async () => {
      try {
        const res = await fetch("/api/swipes/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ party_id, round_id: roundId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load matches");

        setMatches(data.matches ?? []);
      } catch (e: any) {
        setError(e.message ?? "Failed to load matches");
      }
    })();
  }, [party_id, roundId]);

  // Realtime navigation back to swipe
  useEffect(() => {
    if (!party_id) return;

    const ch = supabase
      .channel(`party-results-nav:${party_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${party_id}`,
        },
        (payload: any) => {
          const rec = payload.record ?? payload.new ?? payload.after ?? null;
          const newState = rec?.session_state ?? null;

          setParty(prev => ({
            session_state: newState,
            results_started_at: rec?.results_started_at ?? prev?.results_started_at ?? null,
            current_round_num: rec?.current_round_num ?? prev?.current_round_num ?? null,
          }));

          if (newState === "in_progress") {
            router.push(`/party/swipe?party=${party_id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [party_id, router]);

  const advanceNextRound = async () => {
    if (!party_id || !roundId) return;
    if (advancing) return;

    setAdvancing(true);
    setError(null);

    try {
      const res = await fetch("/api/rounds/nextRound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_id, round_id: roundId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to advance round");
      }
      // do NOT router.push here — realtime subscription will handle navigation
    } catch (e: any) {
      setError(e.message ?? "Failed to advance round");
    } finally {
      setAdvancing(false);
    }
  };

  useEffect(() => {
    if (party?.session_state !== "results") return;
    if (secondsLeft === 0) advanceNextRound();
  }, [secondsLeft, party?.session_state]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Round Results</h1>

      {error && (
        <div className="border border-red-300 text-red-700 rounded p-2">
          {error}
        </div>
      )}

      <div className="rounded border border-gray-700 p-3">
        <div className="font-semibold">Next round in {secondsLeft}s</div>
        <div className="text-sm text-gray-400">
          Auto-advancing to next round...
        </div>

        {isHost && (
          <button
            onClick={advanceNextRound}
            disabled={advancing || !roundId}
            className="mt-3 rounded bg-indigo-600 text-white px-4 py-2 disabled:opacity-50"
          >
            {advancing ? "Advancing..." : "Next round"}
          </button>
        )}
      </div>

      {matches.length === 0 ? (
        <p>No matches yet...</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {matches.map((m) => (
            <li key={`${m.media_type}:${m.tmdb_id}`}>
              {m.title} ({m.media_type})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}