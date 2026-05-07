// app/_components/SwipeCard.tsx
"use client";

import { Candidate } from "@/app/_lib/swipeApi";

type SwipeCardProps = {
  candidate: Candidate;
  disabled: boolean;
  onSwipe: (dir: "left" | "right") => Promise<void>;
};

export default function SwipeCard({
  candidate,
  disabled,
  onSwipe,
}: SwipeCardProps) {
  return (
    <div className="mx-auto max-w-sm rounded-[28px] border border-white/10 bg-white/5 p-5 text-white">
      <div className="overflow-hidden rounded-2xl bg-white/10">
        {candidate.poster_path ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://image.tmdb.org/t/p/w342${candidate.poster_path}`}
            alt={candidate.title}
            className="w-full object-cover"
          />
        ) : (
          <div className="grid aspect-[2/3] place-items-center text-white/50">
            No poster
          </div>
        )}
      </div>

      <h2 className="mt-4 truncate text-2xl font-bold">{candidate.title}</h2>
      <p className="mt-1 text-sm text-white/50">{candidate.media_type}</p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          disabled={disabled}
          onClick={() => onSwipe("left")}
          className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 disabled:opacity-50"
        >
          Skip
        </button>

        <button
          disabled={disabled}
          onClick={() => onSwipe("right")}
          className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 disabled:opacity-50"
        >
          Like
        </button>
      </div>
    </div>
  );
}