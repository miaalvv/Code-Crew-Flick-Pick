"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import SwipeDeck from "@/app/_components/SwipeDeck";

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

  // Load first card
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

  async function handleSwipe(dir: "left" | "right") {
    if (!party_id || !current) return;

    const liked = dir === "right";

    setLoading(true);
    setError(null);

    try {
      // 1) send swipe (your existing backend call)
      const result = await sendSwipe(party_id, current, liked);

      // If your sendSwipe returns a match, add it (safe optional)
      // If your API doesn't return a match object, this won't break anything.
      if (result?.match) {
        setMatches((prev) => [result.match as Match, ...prev]);
      }

      // 2) load next card
      const { next } = await getNextCard(party_id);
      setCurrent(next ?? null);
    } catch (e: any) {
      console.error("swipe error:", e);
      setError(e?.message ?? "Failed to swipe");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-7">
        <h1 className="text-4xl font-bold tracking-tight text-white">
          Swipe
        </h1>
        <p className="mt-2 text-white/60">
          Swipe right to like, left to pass.
        </p>
      </div>

      {!party_id && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/80">
          Missing party id. Open this page using a party link/code.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-200">
          {error}
        </div>
      )}

      {party_id && (
        <>
          {/* ✅ Animated swipe card */}
          {current ? (
            <SwipeDeck
              candidate={current as any}
              disabled={loading}
              onSwipe={handleSwipe}
            />
          ) : (
            <div className="mx-auto grid max-w-xl place-items-center rounded-[28px] border border-white/10 bg-white/5 p-10 text-white/80">
              {loading ? "Loading…" : "No more movies 🎬"}
            </div>
          )}

          {/* Optional: show matches if you already track them */}
          {matches.length > 0 && (
            <div className="mt-10 rounded-[28px] border border-white/10 bg-white/5 p-6">
              <div className="mb-3 text-lg font-semibold text-white">
                Matches
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {matches.slice(0, 6).map((m) => (
                  <div
                    key={`${m.media_type}-${m.tmdb_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3"
                  >
                    <div className="h-12 w-9 overflow-hidden rounded-lg bg-white/10">
                      {m.poster_path ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`https://image.tmdb.org/t/p/w154${m.poster_path}`}
                          alt={m.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-white">
                        {m.title}
                      </div>
                      <div className="text-sm text-white/50">{m.media_type}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
