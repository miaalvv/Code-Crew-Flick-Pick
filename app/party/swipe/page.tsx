// app/party/swipe/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/app/_lib/supabaseClient";

import { getNextCard, sendSwipe, Candidate } from "@/app/_lib/swipeApi";
import { getCurrentRound, completeRound } from "@/app/_lib/roundsApi";

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
};

type WinnerDetails = {
  overview: string;
  release_date: string;
  runtime: number | null;
  genres: string[];
  vote_average: number;
  number_of_seasons: number | null;
};

type CardDetails = WinnerDetails;

function SwipePageContent() {
  const params = useSearchParams();
  const router = useRouter();
  const party_id = params.get("party") ?? "";

  const [current, setCurrent] = useState<Candidate | null>(null);

  // Keep matches in memory (for reveal), but don't show mid-round
  const [matches, setMatches] = useState<Match[]>([]);

  const [roundId, setRoundId] = useState<string | null>(null);
  const [movieIndex, setMovieIndex] = useState<number | null>(null);
  const [totalMovies, setTotalMovies] = useState<number | null>(null);

  // Realtime match counter (does NOT reveal titles)
  const [matchCount, setMatchCount] = useState<number>(0);

  const [loading, setLoading] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sessionFinished, setSessionFinished] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);
  const [currentDetails, setCurrentDetails] = useState<CardDetails | null>(null);
  const [currentCardFlipped, setCurrentCardFlipped] = useState(false);
  const [winnerDetails, setWinnerDetails] = useState<WinnerDetails | null>(null);
  const [winnerSynopsisExpanded, setWinnerSynopsisExpanded] = useState(false);
  const [winnerCardFlipped, setWinnerCardFlipped] = useState(false);
  const [showWinnerConfetti, setShowWinnerConfetti] = useState(false);

  // used to avoid spamming completeRound in a loop
  const completeRequestedRef = useRef(false);
  const currentCardPointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const winnerCardPointerStartRef = useRef<{ x: number; y: number } | null>(null);

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
        setMovieIndex(null);
        setTotalMovies(null);
        setMatchCount(0);
        setInfo("No active round right now — waiting for the session to continue…");
        return;
      }

      setRoundId(roundRes.round.round_id);

      // Reset per-round UI state
      setMatchCount(0);
      setMatches([]);
      setSessionFinished(false);
      setCurrentDetails(null);
      setCurrentCardFlipped(false);
      setWinnerDetails(null);
      setWinnerSynopsisExpanded(false);
      setWinnerCardFlipped(false);
      completeRequestedRef.current = false;

      const { next, seen_count, total_count } = await getNextCard(party_id);
      setCurrent(next ?? null);
      setMovieIndex(next ? seen_count + 1 : total_count > 0 ? total_count : null);
      setTotalMovies(total_count);
    } catch (e: any) {
      console.error("loadInitial error:", e);
      setError(e?.message ?? "Failed to load swipe session");
      setCurrent(null);
      setRoundId(null);
      setMovieIndex(null);
      setTotalMovies(null);
      setMatchCount(0);
      setCurrentDetails(null);
      setCurrentCardFlipped(false);
      setWinnerDetails(null);
      setWinnerSynopsisExpanded(false);
      setWinnerCardFlipped(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!party_id) return;
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [party_id]);

  useEffect(() => {
    setSwipeDirection(null);
  }, [current?.tmdb_id, roundId]);

  useEffect(() => {
    setCurrentCardFlipped(false);

    if (!current) {
      setCurrentDetails(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/tmdb/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: current.tmdb_id,
            media_type: current.media_type,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load card details");
        if (!cancelled) setCurrentDetails(data.details ?? null);
      } catch (e) {
        console.error("card details error:", e);
        if (!cancelled) setCurrentDetails(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [current]);

  useEffect(() => {
    if (!sessionFinished || matches.length !== 1) {
      setWinnerDetails(null);
      setWinnerSynopsisExpanded(false);
      setWinnerCardFlipped(false);
      setShowWinnerConfetti(false);
      return;
    }

    const winner = matches[0];
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/tmdb/details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdb_id: winner.tmdb_id,
            media_type: winner.media_type,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load winner details");
        if (!cancelled) setWinnerDetails(data.details ?? null);
      } catch (e) {
        console.error("winner details error:", e);
        if (!cancelled) setWinnerDetails(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionFinished, matches]);

  useEffect(() => {
    if (!sessionFinished || matches.length !== 1) return;

    setShowWinnerConfetti(true);
    const timeout = setTimeout(() => setShowWinnerConfetti(false), 3500);
    return () => clearTimeout(timeout);
  }, [sessionFinished, matches]);

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

  async function handleSwipe(decision: "like" | "skip", direction?: "left" | "right") {
    if (!current || !party_id || loading || roundLoading || swipeDirection) return;

    const nextDirection = direction ?? (decision === "like" ? "right" : "left");
    setSwipeDirection(nextDirection);

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 180));

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

      const { next, seen_count, total_count } = await getNextCard(party_id);
      setCurrent(next ?? null);
      setMovieIndex(next ? seen_count + 1 : total_count > 0 ? total_count : null);
      setTotalMovies(total_count);
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
        setMovieIndex(null);

        // optional: nudge server completion check (safe)
        if (roundId) {
          completeRequestedRef.current = false;
          completeRound(party_id, roundId).catch(() => {});
        }
        return;
      }

      console.error("sendSwipe error:", e);
      setError(msg || "Failed to submit swipe");
      setSwipeDirection(null);
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
          setInfo(null);
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
  const winnerOverview = winnerDetails?.overview?.trim() ?? "";
  const synopsisLimit = 220;
  const hasLongSynopsis = winnerOverview.length > synopsisLimit;
  const displayedSynopsis =
    hasLongSynopsis && !winnerSynopsisExpanded
      ? `${winnerOverview.slice(0, synopsisLimit).trimEnd()}...`
      : winnerOverview || "No synopsis available.";
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        id: index,
        left: `${4 + ((index * 13) % 92)}%`,
        delay: (index % 7) * 0.12,
        duration: 2.2 + (index % 5) * 0.28,
        rotate: (index % 2 === 0 ? 1 : -1) * (18 + (index % 4) * 10),
        color: ["#f472b6", "#34d399", "#fbbf24", "#60a5fa"][index % 4],
      })),
    []
  );

  function shouldTreatAsTap(
    start: { x: number; y: number } | null,
    end: { x: number; y: number }
  ) {
    if (!start) return true;
    return Math.abs(end.x - start.x) < 12 && Math.abs(end.y - start.y) < 12;
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {showWinnerConfetti && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          {confettiPieces.map((piece) => (
            <motion.span
              key={piece.id}
              className="absolute top-[-10%] h-4 w-2 rounded-sm opacity-90"
              style={{ left: piece.left, backgroundColor: piece.color }}
              initial={{ y: "-10vh", rotate: 0, opacity: 0 }}
              animate={{
                y: "115vh",
                rotate: piece.rotate * 12,
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: piece.duration,
                delay: piece.delay,
                ease: "easeOut",
              }}
            />
          ))}
        </div>
      )}

      <div className="overflow-visible rounded-[32px] border border-slate-700/70 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_35%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] p-5 shadow-2xl shadow-black/40">
        {movieIndex != null && totalMovies != null && !sessionFinished && (
          <div className="mb-5 text-center">
            <div className="text-3xl font-semibold text-slate-50">
              {movieIndex} <span className="text-lg font-medium text-slate-400">/ {totalMovies}</span>
            </div>
          </div>
        )}

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/50 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {info && !error && (
        <div className="mt-4 rounded-2xl border border-sky-400/40 bg-sky-950/30 px-4 py-3 text-sm text-sky-100">
          {info}
        </div>
      )}

      {loading && !current && !error && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-300">
          Loading your next card…
        </div>
      )}

      <AnimatePresence mode="wait">
        {current && (
          <motion.div
            key={`${current.media_type}:${current.tmdb_id}`}
            className="relative z-10 mt-6 touch-pan-y"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: swipeDirection === "right" ? 180 : swipeDirection === "left" ? -180 : 0,
              rotate: swipeDirection === "right" ? 10 : swipeDirection === "left" ? -10 : 0,
            }}
            exit={{ opacity: 0, y: -12, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            drag={loading || roundLoading ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              if (info.offset.x > 90) {
                handleSwipe("like", "right");
              } else if (info.offset.x < -90) {
                handleSwipe("skip", "left");
              }
            }}
          >
            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-xl shadow-black/40">
              <div className="p-2">
                <div className="[perspective:1200px]">
                  <motion.div
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => {
                      currentCardPointerStartRef.current = { x: e.clientX, y: e.clientY };
                    }}
                    onPointerUp={(e) => {
                      if (
                        shouldTreatAsTap(currentCardPointerStartRef.current, {
                          x: e.clientX,
                          y: e.clientY,
                        })
                      ) {
                        setCurrentCardFlipped((prev) => !prev);
                      }
                      currentCardPointerStartRef.current = null;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setCurrentCardFlipped((prev) => !prev);
                      }
                    }}
                    className="relative aspect-[2/3] w-full rounded-[24px] text-left"
                    animate={{ rotateY: currentCardFlipped ? 180 : 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    style={{ transformStyle: "preserve-3d" }}
                  >
                    <div
                      className="absolute inset-0 overflow-hidden rounded-[24px] bg-slate-900"
                      style={{ backfaceVisibility: "hidden" }}
                    >
                      {current.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w500${current.poster_path}`}
                          alt={current.title}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-6 text-center text-lg font-semibold text-slate-200">
                          {current.title}
                        </div>
                      )}

                      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
                        <span className="text-xs font-semibold tracking-[0.12em] text-white/80">
                          Click for more info
                        </span>
                      </div>
                    </div>

                    <div
                      className="absolute inset-0 overflow-hidden rounded-[24px] bg-slate-950 p-4"
                      style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                    >
                      <div className="flex h-full flex-col">
                        <div>
                          <h2 className="text-2xl font-semibold text-slate-50">{current.title}</h2>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                              {current.media_type === "tv" ? "Series" : "Movie"}
                            </span>
                            {currentDetails?.release_date ? (
                              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                                {currentDetails.release_date.slice(0, 4)}
                              </span>
                            ) : null}
                            {currentDetails?.runtime ? (
                              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                                {currentDetails.runtime} min
                              </span>
                            ) : null}
                            {currentDetails?.number_of_seasons ? (
                              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                                {currentDetails.number_of_seasons} season{currentDetails.number_of_seasons === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {currentDetails?.vote_average ? (
                              <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                                {currentDetails.vote_average.toFixed(1)} rating
                              </span>
                            ) : null}
                          </div>
                        </div>

                        {currentDetails?.genres?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {currentDetails.genres.slice(0, 4).map((genre) => (
                              <span
                                key={genre}
                                className="rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs text-pink-100"
                              >
                                {genre}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-4 line-clamp-[10] text-sm leading-6 text-slate-300">
                          {currentDetails?.overview || "No synopsis available."}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>

              <div className="border-t border-white/10 bg-slate-950/90 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleSwipe("skip", "left")}
                    disabled={loading || roundLoading}
                    className="rounded-2xl border border-slate-700 bg-slate-900/80 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-rose-400 hover:text-rose-100 disabled:opacity-50"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => handleSwipe("like", "right")}
                    disabled={loading || roundLoading}
                    className="rounded-2xl bg-pink-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition hover:bg-pink-400 disabled:opacity-50"
                  >
                    Like
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {noMoreCards && !error && !sessionFinished && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-5 text-center">
          <div className="text-base font-semibold text-slate-100">No more cards this round</div>
          <p className="mt-2 text-sm text-slate-300">Waiting for the rest of the group…</p>
          {roundLoading && <div className="mt-3 text-sm text-slate-400">Checking round status…</div>}
        </div>
      )}

      {sessionFinished && matches.length === 1 && (
        <div className="mt-4 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">
            Winner!
          </h1>
        </div>
      )}

      {sessionFinished && matches.length === 1 && (
        <div className="mt-3">
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-xl shadow-black/40">
            <div className="p-1.5">
              <div className="[perspective:1200px]">
                <motion.div
                  role="button"
                  tabIndex={0}
                  onPointerDown={(e) => {
                    winnerCardPointerStartRef.current = { x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    if (
                      shouldTreatAsTap(winnerCardPointerStartRef.current, {
                        x: e.clientX,
                        y: e.clientY,
                      })
                    ) {
                      setWinnerCardFlipped((prev) => !prev);
                    }
                    winnerCardPointerStartRef.current = null;
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setWinnerCardFlipped((prev) => !prev);
                    }
                  }}
                  className="relative aspect-[2/3] w-full rounded-[26px] text-left"
                  animate={{ rotateY: winnerCardFlipped ? 180 : 0 }}
                  transition={{ duration: 0.55, ease: "easeInOut" }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <div
                    className="absolute inset-0 overflow-hidden rounded-[26px] bg-slate-900"
                    style={{ backfaceVisibility: "hidden" }}
                  >
                    {matches[0].poster_path ? (
                      <Image
                        src={`https://image.tmdb.org/t/p/w500${matches[0].poster_path}`}
                        alt={matches[0].title}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center px-6 text-center text-lg font-semibold text-slate-200">
                        {matches[0].title}
                      </div>
                    )}

                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-4">
                      <span className="text-xs font-semibold tracking-[0.12em] text-white/80">
                        Click for more info
                      </span>
                    </div>
                  </div>

                  <div
                    className="absolute inset-0 overflow-hidden rounded-[26px] bg-slate-950 p-4"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <div className="flex h-full flex-col">
                      <div>
                        <h2 className="text-2xl font-semibold text-slate-50">{matches[0].title}</h2>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                          <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                            {matches[0].media_type === "tv" ? "Series" : "Movie"}
                          </span>
                          {winnerDetails?.release_date ? (
                            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                              {winnerDetails.release_date.slice(0, 4)}
                            </span>
                          ) : null}
                          {winnerDetails?.runtime ? (
                            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                              {winnerDetails.runtime} min
                            </span>
                          ) : null}
                          {winnerDetails?.number_of_seasons ? (
                            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                              {winnerDetails.number_of_seasons} season{winnerDetails.number_of_seasons === 1 ? "" : "s"}
                            </span>
                          ) : null}
                          {winnerDetails?.vote_average ? (
                            <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1">
                              {winnerDetails.vote_average.toFixed(1)} rating
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {winnerDetails?.genres?.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {winnerDetails.genres.slice(0, 4).map((genre) => (
                            <span
                              key={genre}
                              className="rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs text-pink-100"
                            >
                              {genre}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      <div className="mt-4 flex-1 space-y-2 overflow-hidden">
                        <p className="text-sm leading-6 text-slate-300">{displayedSynopsis}</p>
                        {hasLongSynopsis && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setWinnerSynopsisExpanded((prev) => !prev);
                            }}
                            className="text-sm font-semibold text-pink-300 transition hover:text-pink-200"
                          >
                            {winnerSynopsisExpanded ? "Read less" : "Read more..."}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-slate-950/90 px-4 py-3 text-center text-sm font-semibold text-slate-200">
              Winning pick
            </div>
          </div>
        </div>
      )}

      {!!matches.length && (noMoreCards || sessionFinished) && !sessionFinished && (
        <div className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="mb-2 text-base font-semibold text-slate-50">
            {sessionFinished ? "Winner" : "Matched Movies (revealed at round end)"}
          </div>
          <ul className="space-y-2 text-sm text-slate-200">
            {matches.map((m) => (
              <li
                key={`${m.media_type}:${m.tmdb_id}`}
                className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2"
              >
                {m.title} ({m.media_type})
              </li>
            ))}
          </ul>
        </div>
      )}
      </div>
    </div>
  );
}

export default function SwipePage() {
  return (
    <Suspense fallback={<div className="p-6 text-white">Loading swipe page...</div>}>
      <SwipePageContent />
    </Suspense>
  );
}