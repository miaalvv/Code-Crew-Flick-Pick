// app/party/swipe/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

import {
  getNextCard,
  sendSwipe,
  Candidate,
} from "@/app/_lib/swipeApi";

import {
  getCurrentRound,
  completeRound,
  nextRound,
} from "@/app/_lib/roundsApi";

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
};

export default function SwipePage() {
  const params = useSearchParams();
  const party_id = params.get("party") ?? "";

  const [current, setCurrent] = useState<Candidate | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [roundNum, setRoundNum] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);

  // Load current round + first card
  async function loadInitial() {
    if (!party_id) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const roundRes = await getCurrentRound(party_id);
      if (!roundRes.ok) {
        throw new Error(roundRes.error ?? "Failed to load round");
      }

      if (!roundRes.round) {
        // No active round at all for this party
        setError("No active round for this party");
        setCurrent(null);
        return;
      }

      setRoundNum(roundRes.round.round_num ?? null);

      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
      setMatches([]);
    } catch (e: any) {
      console.error("loadInitial error:", e);
      setError(e?.message ?? "Failed to load swipe session");
      setCurrent(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!party_id) return;
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party_id]);

  async function handleSwipe(decision: "like" | "skip") {
    if (!current || !party_id) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await sendSwipe({
        party_id,
        tmdb_id: current.tmdb_id,
        media_type: current.media_type,
        title: current.title,
        poster_path: current.poster_path ?? null,
        decision,
      });

      if (Array.isArray(res.matches)) {
        setMatches(res.matches);
      }

      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
    } catch (e: any) {
      console.error("sendSwipe error:", e);
      setError(e?.message ?? "Failed to submit swipe");
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckRound() {
    if (!party_id) return;

    setRoundLoading(true);
    setError(null);
    setInfo(null);

    try {
      // Ask the backend what the *current* active round is
      const roundRes = await getCurrentRound(party_id);
      if (!roundRes.ok) {
        throw new Error(roundRes.error ?? "Could not get round info");
      }

      const serverRound = roundRes.round || null;

      // If no active round exists anymore, the session MUST be finished
      if (!serverRound) {
        // Show final winner from matches if we already have it
        if (matches.length === 1) {
          setSessionFinished(true);
          setInfo("Session finished! A winning movie has been chosen.");
          return;
        }

        // Otherwise fallback final message
        setSessionFinished(true);
        setCurrent(null);
        setInfo("Session finished!");
        return;
      }

      const serverRoundNum: number = serverRound.round_num;

      // CASE 1: Server round is *ahead* of what this client thinks.
      // This happens when someone else already started the next round.
      if (roundNum == null || serverRoundNum > roundNum) {
        setRoundNum(serverRoundNum);
        const { next } = await getNextCard(party_id);
        setCurrent(next ?? null);
        setMatches([]);
        setInfo(`Round ${serverRoundNum} started!`);
        return;
      }

      // CASE 2: We still have a card – user should keep swiping, not check status.
      if (current) {
        setInfo("Keep swiping — you still have cards left in this round.");
        return;
      }

      // CASE 3: We are done with our cards for this round.
      // Ask backend if the round is complete for *everyone*.
      const status = await completeRound(party_id, serverRound.round_id);
      if (!status.ok) {
        throw new Error(status.error ?? "Error checking round status");
      }

      if (!status.isRoundComplete) {
        setInfo(
          "Round is not complete yet. Waiting for everyone to finish swiping."
        );
        return;
      }

      // Round is complete.
      if (status.isSessionFinished) {
        // Whole session is done – show winner
        setSessionFinished(true);
        if (status.winner) {
          setMatches([status.winner]);
        }
        setCurrent(null);
        setInfo("Session finished! A winning movie has been chosen.");
        return;
      }

      // Round complete, session not finished – start the next round.
      const nextRes = await nextRound(party_id, serverRound.round_id);
      if (!nextRes.ok || !nextRes.new_round) {
        throw new Error(nextRes.error ?? "Could not start next round");
      }

      const newRound = nextRes.new_round;
      setRoundNum(newRound.round_num ?? null);

      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
      setMatches([]);
      setInfo(`Round ${newRound.round_num} started!`);
    } catch (e: any) {
      console.error("handleCheckRound error:", e);
      setError(e?.message ?? "Error checking round status");
    } finally {
      setRoundLoading(false);
    }
  }

  const noMoreCards = !loading && !current;

  return (
    <div className="mx-auto max-w-md p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Swipe</h1>
      {roundNum != null && (
        <p className="text-sm text-gray-400">Round {roundNum}</p>
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
            <p className="text-sm text-gray-400">
              {current.media_type.toUpperCase()}
            </p>
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
        <div className="space-y-3">
          <div className="text-gray-400">
            No more cards for you in this round 🎉
          </div>
          <p className="text-sm text-gray-400">
            When everyone in the party finishes swiping, the next round will be
            ready. Click below to check the round status.
          </p>
          <button
            onClick={handleCheckRound}
            disabled={roundLoading}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {roundLoading ? "Checking…" : "Check round status"}
          </button>
        </div>
      )}

      {sessionFinished && (
        <div className="mt-4 text-green-300 text-sm">
          Session finished! 🎬 Check the winning movie below.
        </div>
      )}

      {!!matches.length && (
        <div className="mt-6 rounded-xl border p-3">
          <div className="font-semibold mb-2">Party Matches</div>
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
