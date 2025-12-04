'use client';

import { useEffect, useState } from 'react';

type TMDBItem = {
  id: number;
  title?: string;   // movies
  name?: string;    // tv shows
  poster_path?: string | null;
};

type PingResponse = {
  ok: boolean;
  sample?: TMDBItem;
};

export default function HomePage() {
  const [sample, setSample] = useState<PingResponse | null>(null);

  useEffect(() => {
    fetch('/api/tmdb/ping')
      .then((r) => r.json())
      .then(setSample)
      .catch(console.error);
  }, []);

  const sampleTitle = sample?.sample?.title ?? sample?.sample?.name;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)] items-center mt-4">
      {/* LEFT SIDE: hero text */}
      <section className="space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-xs font-medium text-pink-200">
          <span className="h-2 w-2 rounded-full bg-pink-400" />
          New • Movie night made easy
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop arguing over what to watch.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
            FlickPick lets your group swipe through movies like a dating app.
            Everyone swipes, we match your vibes, and you&apos;re watching in minutes –
            not still scrolling at 10:30 pm.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 hover:bg-pink-400 transition"
          >
            Get started – it&apos;s free
          </a>
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900/70 px-5 py-2.5 text-sm font-medium text-slate-100 hover:border-pink-400 hover:text-pink-100 transition"
          >
            Go to dashboard
          </a>
        </div>

        <ul className="flex flex-wrap gap-4 text-xs text-slate-400">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            No passwords – email magic links only
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
            TMDB-powered movie data
          </li>
        </ul>
      </section>

      {/* RIGHT SIDE: sample swipe card */}
      <section className="hidden md:block">
        <div className="relative rounded-3xl border border-slate-700/70 bg-slate-900/70 p-5 shadow-2xl shadow-black/40 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            Swipe preview
          </p>

          <div className="mt-4 flex gap-4">
            {/* Poster placeholder */}
            <div className="relative h-40 w-28 overflow-hidden rounded-2xl bg-slate-800/80">
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-500">
                Poster
              </div>
            </div>

            {/* Text content */}
            <div className="flex flex-1 flex-col justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {sampleTitle ?? 'Sample TMDB movie'}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {sample?.ok
                    ? 'TMDB API is connected. This is a real title from the popular list.'
                    : 'We&apos;ll show you real movie data from TMDB as soon as the API is ready.'}
                </p>
              </div>

              <div className="mt-4 flex gap-3">
                <button className="flex-1 rounded-full bg-emerald-500/90 px-3 py-2 text-xs font-semibold text-emerald-50 hover:bg-emerald-400 transition">
                  Swipe right
                </button>
                <button className="flex-1 rounded-full bg-rose-500/90 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-400 transition">
                  Swipe left
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
