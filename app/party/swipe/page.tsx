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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // load first card
  useEffect(() => {
    if (!party_id) return;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { next } = await getNextCard(party_id);
        setCurrent(next ?? null);
      } catch (e: any) {
        console.error("getNextCard error:", e);
        setError(e?.message ?? "Failed to load next card");
        setCurrent(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [party_id]);

  async function handleSwipe(decision: "like" | "skip") {
    if (!current || !party_id) return;

    setLoading(true);
    setError(null);
    try {
      // send decision
      const res = await sendSwipe({
        party_id,
        tmdb_id: current.tmdb_id,
        media_type: current.media_type,
        title: current.title,
        poster_path: current.poster_path ?? null,
        decision,
      });

      // if API returns matches, update list
      if (Array.isArray(res.matches)) {
        setMatches(res.matches);
      }

      // get next card
      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
    } catch (e: any) {
      console.error("sendSwipe error:", e);
      setError(e?.message ?? "Failed to submit swipe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Swipe</h1>

      {/* show any error */}
      {error && (
        <div className="rounded border border-red-400 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading && !current && !error && <div>Loading…</div>}

      {/* card */}
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
              disabled={loading}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Skip
            </button>
            <button
              onClick={() => handleSwipe("like")}
              disabled={loading}
              className="rounded-xl border px-4 py-2 hover:bg-gray-50 disabled:opacity-50"
            >
              Like 👍
            </button>
          </div>
        </div>
      )}

      {/* no card & no error */}
      {!loading && !current && !error && (
        <div className="text-gray-400">No more cards 🎉</div>
      )}

      {/* matches */}
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
