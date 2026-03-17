// app/party/swipe/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/app/_lib/supabaseClient";

import { getNextCard, sendSwipe, Candidate } from "@/app/_lib/swipeApi";
import { getCurrentRound, completeRound } from "@/app/_lib/roundsApi";

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
};

export default function SwipePage() {
  const params = useSearchParams();
  const router = useRouter();
  const party_id = params.get("party") ?? "";

  const [current, setCurrent] = useState<Candidate | null>(null);

  // Keep matches in memory (for reveal), but don't show mid-round
  const [matches, setMatches] = useState<Match[]>([]);

  const [roundNum, setRoundNum] = useState<number | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);

  // Realtime match counter (does NOT reveal titles)
  const [matchCount, setMatchCount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);

  // used to avoid spamming completeRound in a loop
  const completeRequestedRef = useRef(false);

  // Load current round + first card
  async function loadInitial() {
    if (!party_id) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const roundRes = await getCurrentRound(party_id);
      if (!roundRes.ok) throw new Error(roundRes.error ?? "Failed to load round");

      if (!roundRes.round) {
        // Don't hard-fail; this can happen if the round just ended
        setCurrent(null);
        setRoundId(null);
        setRoundNum(null);
        setMatchCount(0);
        setInfo("No active round right now — waiting for the session to continue…");
        return;
      }

      setRoundNum(roundRes.round.round_num ?? null);
      setRoundId(roundRes.round.round_id);

      // Reset per-round UI state
      setMatchCount(0);
      setMatches([]);
      setSessionFinished(false);
      completeRequestedRef.current = false;

      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
    } catch (e: any) {
      console.error("loadInitial error:", e);
      setError(e?.message ?? "Failed to load swipe session");
      setCurrent(null);
      setRoundId(null);
      setRoundNum(null);
      setMatchCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!party_id) return;
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party_id]);

  // Realtime: count matches (is_match=true) for THIS round only.
  useEffect(() => {
    if (!party_id || !roundId) return;

    let cancelled = false;

    async function refreshMatchCount() {
      const { count, error } = await supabase
        .from("party_candidates")
        .select("*", { head: true, count: "exact" })
        .eq("party_id", party_id)
        .eq("round_id", roundId)
        .eq("is_match", true);

      if (!cancelled && !error) setMatchCount(count ?? 0);
    }

    refreshMatchCount();

    const channel = supabase
      .channel(`match-count:${party_id}:${roundId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "party_candidates",
          filter: `party_id=eq.${party_id}`,
        },
        (payload) => {
          const row: any = payload.new ?? payload.old;
          if (!row) return;

          if (row.round_id !== roundId) return;
          if (row.is_match !== true) return;

          refreshMatchCount();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [party_id, roundId]);

  // Realtime navigation based on party session_state
  useEffect(() => {
    if (!party_id) return;

    const ch = supabase
      .channel(`party-state-swipe:${party_id}`)
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
          const state = rec?.session_state ?? null;

          if (state === "results") {
            // roundId can be null if this client is behind; still navigate
            const r = roundId ? `&round=${roundId}` : "";
            router.push(`/party/results?party=${party_id}${r}`);
          }

          // If the server flipped back to in_progress (next round started),
          // we can reload to pick up the new round + first card.
          if (state === "in_progress") {
            // If we currently have no round/card, reload to resync.
            // (Avoid reload loops by only reloading when we're "empty".)
            if (!current) {
              loadInitial();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // include roundId/current so redirect query param isn't stale, and reload condition is correct
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party_id, router, roundId, current]);

  async function handleSwipe(decision: "like" | "skip") {
    if (!current || !party_id) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await sendSwipe({
        party_id,
        round_id: roundId, // critical: avoid active-round race
        tmdb_id: current.tmdb_id,
        media_type: current.media_type,
        title: current.title,
        poster_path: current.poster_path ?? null,
        decision,
      });

      if (Array.isArray(res.matches)) setMatches(res.matches);

      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
    } catch (e: any) {
      const status = e?.status;
      const msg = String(e?.message ?? "");

      // Graceful handling for last-card / round-end race:
      // If the round ended while this user was swiping, don't show a scary error.
      if (
        status === 409 ||
        msg.toLowerCase().includes("round has ended") ||
        msg.toLowerCase().includes("no active round")
      ) {
        setError(null);
        setInfo("Round just ended — moving you to results…");
        setCurrent(null);

        // optional: nudge server completion check (safe)
        if (roundId) {
          completeRequestedRef.current = false;
          completeRound(party_id, roundId).catch(() => {});
        }
        return;
      }

      console.error("sendSwipe error:", e);
      setError(msg || "Failed to submit swipe");
    } finally {
      setLoading(false);
    }
  }

  // Automatic "completeRound" when user runs out of cards
  useEffect(() => {
    if (!party_id) return;
    if (!roundId) return;
    if (loading) return;

    const noMoreCards = !current;
    if (!noMoreCards) return;
    if (sessionFinished) return;

    // prevent spamming
    if (completeRequestedRef.current) return;
    completeRequestedRef.current = true;

    let cancelled = false;

    (async () => {
      setRoundLoading(true);
      setError(null);
      setInfo("Waiting for others to finish swiping…");

      try {
        const status = await completeRound(party_id, roundId);
        if (!status.ok) throw new Error(status.error ?? "Error checking round status");

        if (cancelled) return;

        if (!status.isRoundComplete) {
          setInfo("Waiting for others to finish swiping…");
          completeRequestedRef.current = false; // allow retry via polling effect
          return;
        }

        if (status.isSessionFinished) {
          setSessionFinished(true);
          setInfo("Session finished! Winner has been chosen.");
          if (status.winner) setMatches([status.winner]);
          return;
        }

        // If not finished: server should have flipped party to results; realtime will redirect
        setInfo("Round complete! Showing results…");
      } catch (e: any) {
        console.error("auto completeRound error:", e);
        setError(e?.message ?? "Error checking round status");
        completeRequestedRef.current = false;
      } finally {
        if (!cancelled) setRoundLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [party_id, roundId, current, loading, sessionFinished]);

  // Fallback polling while waiting (covers missed realtime / missed calls)
  useEffect(() => {
    if (!party_id || !roundId) return;
    if (sessionFinished) return;

    const noMoreCards = !loading && !current;
    if (!noMoreCards) return;

    const t = setInterval(async () => {
      if (completeRequestedRef.current) return;

      try {
        completeRequestedRef.current = true;

        const status = await completeRound(party_id, roundId);
        if (!status.ok) {
          completeRequestedRef.current = false;
          return;
        }

        if (!status.isRoundComplete) {
          completeRequestedRef.current = false;
          return;
        }

        if (status.isSessionFinished) {
          setSessionFinished(true);
          if (status.winner) setMatches([status.winner]);
          return;
        }

        // Not finished: server should flip to results and realtime will redirect
      } catch {
        completeRequestedRef.current = false;
      }
    }, 2000);

    return () => clearInterval(t);
  }, [party_id, roundId, current, loading, sessionFinished]);

  const noMoreCards = useMemo(() => !loading && !current, [loading, current]);

  return (
    <div className="mx-auto max-w-md p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Swipe</h1>

      {roundNum != null && (
        <div className="text-sm text-gray-400 flex items-center justify-between">
          <span>Round {roundNum}</span>
          <span>Matches found: {matchCount}</span>
        </div>
      )}

      {error && (
        <div className="rounded border border-red-400 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {info && !error && (
        <div className="rounded border border-blue-400 bg-blue-950/40 px-3 py-2 text-sm text-blue-200">
          {info}
        </div>
      )}

      {loading && !current && !error && <div>Loading…</div>}

      {current && (
        <div className="rounded-2xl border p-3 shadow-sm">
          <div className="aspect-[2/3] relative rounded-xl overflow-hidden bg-gray-900">
            {current.poster_path ? (
              <Image
                src={`https://image.tmdb.org/t/p/w500${current.poster_path}`}
                alt={current.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-center px-4">
                {current.title}
              </div>
            )}
          </div>

          <div className="mt-3">
            <h2 className="text-lg font-medium">{current.title}</h2>
            <p className="text-sm text-gray-400">{current.media_type.toUpperCase()}</p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSwipe("skip")}
              disabled={loading || roundLoading}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={() => handleSwipe("like")}
              disabled={loading || roundLoading}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Like 👍
            </button>
          </div>
        </div>
      )}

      {noMoreCards && !error && !sessionFinished && (
        <div className="space-y-2">
          <div className="text-gray-400">No more cards for you in this round!</div>
          <p className="text-sm text-gray-400">
            Waiting for everyone to finish swiping… you will automatically move
            to results when the round completes.
          </p>
          {roundLoading && <div className="text-sm text-gray-400">Checking…</div>}
        </div>
      )}

      {sessionFinished && (
        <div className="mt-4 text-green-300 text-sm">
          Session finished! Winner (and final matches) shown below.
        </div>
      )}

      {!!matches.length && (noMoreCards || sessionFinished) && (
        <div className="mt-6 rounded-xl border p-3">
          <div className="font-semibold mb-2">
            {sessionFinished ? "Winner" : "Matched Movies (revealed at round end)"}
          </div>
          <ul className="list-disc list-inside text-sm space-y-1">
            {matches.map((m) => (
              <li key={`${m.media_type}:${m.tmdb_id}`}>
                {m.title} ({m.media_type})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}