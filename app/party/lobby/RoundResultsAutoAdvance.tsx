import React, { useEffect, useRef, useState } from "react";

export type MovieResult = {
  id: string;
  title: string;
  thumbnailUrl?: string;
  votes: number;
};

export type RoundResultsAutoAdvanceProps = {
  results: MovieResult[]; // results for this round (sorted by rank)
  onAdvance: (nextRound?: number) => void; // called when advancing
  roundIndex?: number; // optional index of current round
  autoAdvanceSeconds?: number; // default 6
  onPause?: () => void; // optional callbacks
  onResume?: () => void;
  className?: string;
  // optional: indicate whether advancement is controlled externally (e.g. group session via sockets)
  controlled?: boolean;
  // optional label override
  title?: string;
};

const defaultSeconds = 6;

export default function RoundResultsAutoAdvance({
  results,
  onAdvance,
  roundIndex,
  autoAdvanceSeconds = defaultSeconds,
  onPause,
  onResume,
  className = "",
  controlled = false,
  title = "Round results",
}: RoundResultsAutoAdvanceProps) {
  const [secondsLeft, setSecondsLeft] = useState(autoAdvanceSeconds);
  const [isPaused, setIsPaused] = useState(false);
  const rafRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);

  // Reset when new results arrive
  useEffect(() => {
    setSecondsLeft(autoAdvanceSeconds);
    setIsPaused(false);
    elapsedRef.current = 0;
    startedAtRef.current = performance.now();
    // start loop
    startTicker();
    return stopTicker;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, autoAdvanceSeconds]);

  function tick(now: number) {
    if (isPaused) {
      startedAtRef.current = now - elapsedRef.current * 1000;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (!startedAtRef.current) startedAtRef.current = now;
    const elapsedMs = now - startedAtRef.current;
    const elapsedSec = Math.min(elapsedMs / 1000, autoAdvanceSeconds);
    elapsedRef.current = elapsedSec;
    const left = Math.max(0, Math.ceil((autoAdvanceSeconds - elapsedSec) * 1000) / 1000);
    setSecondsLeft(Number(left.toFixed(3))); // keep ms precision for smooth progress
    if (elapsedSec >= autoAdvanceSeconds) {
      stopTicker();
      if (!controlled) onAdvance(roundIndex !== undefined ? roundIndex + 1 : undefined);
    } else {
      rafRef.current = requestAnimationFrame(tick);
    }
  }

  function startTicker() {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(tick);
  }
  function stopTicker() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function handlePause() {
    setIsPaused(true);
    onPause?.();
  }
  function handleResume() {
    setIsPaused(false);
    onResume?.();
  }

  function handleSkip() {
    stopTicker();
    onAdvance(roundIndex !== undefined ? roundIndex + 1 : undefined);
  }

  // keyboard accessibility: space toggles pause, right arrow skips
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        isPaused ? handleResume() : handlePause();
      } else if (e.code === "ArrowRight") {
        handleSkip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  const fraction = Math.min(1, elapsedRef.current / Math.max(1, autoAdvanceSeconds));

  return (
    <div
      className={`w-full max-w-3xl mx-auto p-4 rounded-2xl shadow-md bg-white ${className}`}
      role="region"
      aria-labelledby="round-results-title"
      onMouseEnter={() => { if (!isPaused) handlePause(); }}
      onMouseLeave={() => { if (isPaused) handleResume(); }}
      tabIndex={0}
      onFocus={() => { if (!isPaused) handlePause(); }}
      onBlur={() => { if (isPaused) handleResume(); }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="round-results-title" className="text-lg font-semibold">
            {title} {roundIndex !== undefined ? `— Round ${roundIndex + 1}` : ""}
          </h2>
          <p className="text-sm text-gray-500">
            Auto-advancing in <strong aria-live="polite">{secondsLeft}s</strong>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => (isPaused ? handleResume() : handlePause())}
            aria-pressed={isPaused}
            className="px-3 py-1 rounded-md border hover:bg-gray-50 focus:outline-none focus:ring"
          >
            {isPaused ? "Resume" : "Pause"}
          </button>

          <button
            onClick={handleSkip}
            className="px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring"
          >
            Skip
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden" aria-hidden>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${fraction * 100}%` }}
            data-testid="progress-bar"
          />
        </div>
      </div>

      <ul className="space-y-3" aria-live="polite">
        {results.map((r, idx) => (
          <li
            key={r.id}
            className={`flex items-center gap-3 p-2 rounded-lg ${
              idx === 0 ? "bg-yellow-50 border border-yellow-200" : "bg-gray-50"
            }`}
          >
            <div className="w-12 h-8 flex-shrink-0 rounded-md overflow-hidden bg-gray-200">
              {r.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.thumbnailUrl} alt={`${r.title} thumbnail`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">No image</div>
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{r.title}</span>
                <span className="text-sm text-gray-600">{r.votes} votes</span>
              </div>
              <div className="text-xs text-gray-500">Rank #{idx + 1}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 text-right text-xs text-gray-500">
        Hover / focus to pause • Space = pause/resume • → = skip
      </div>
    </div>
  );
}