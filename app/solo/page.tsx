'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../_lib/supabaseClient';

type Movie = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  vote_average: number;
  release_date: string;
};

type DiscoverResponse = {
  ok: boolean;
  results?: Movie[];
  error?: string;
};

export default function SoloSwipePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [needsServices, setNeedsServices] = useState(false);

  // Load user services from Supabase AND movies from TMDB
  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        setNeedsServices(false);

        // 1) Require logged-in user
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = '/login';
          return;
        }

        // 2) Get this user's chosen streaming services
        const { data: rows, error: svcErr } = await supabase
          .from('user_services')
          .select('provider_id')
          .eq('user_id', user.id);

        if (svcErr) {
          console.error('Error loading user_services:', svcErr);
        }

        const ids =
          rows && rows.length > 0
            ? rows.map((r: { provider_id: number }) => r.provider_id)
            : [];

        // If they haven't picked any services, show a "go pick services" message
        if (ids.length === 0) {
          setNeedsServices(true);
          setMovies([]);
          setIndex(0);
          return;
        }

        // 3) Load movies from your TMDB discover API, filtered by those providers
        const res = await fetch('/api/tmdb/discover', {
          method: 'POST',
          body: JSON.stringify({
            provider_ids: ids,
            region: 'US',
            page: 1,
          }),
        });

        if (!res.ok) {
          setError('Failed to load movies from TMDB.');
          return;
        }

        const data: DiscoverResponse = await res.json();

        if (!data.ok || !data.results || data.results.length === 0) {
          setError('No movies were found for your streaming services yet.');
          return;
        }

        const withPosters = data.results.filter((m) => m.poster_path);
        setMovies(withPosters);
        setIndex(0);
        setSwipeDirection(null);
        setLastAction(null);
      } catch (e) {
        console.error(e);
        setError('Something went wrong loading solo swipe.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, []);

  // Reset swipe direction when movie index changes
  useEffect(() => {
    setSwipeDirection(null);
  }, [index]);

  const current = movies[index] ?? null;

  const handleSwipe = (direction: 'left' | 'right') => {
    if (!current) return;

    setSwipeDirection(direction);

    if (direction === 'right') {
      setLastAction(`You liked "${current.title}" 👍`);
    } else {
      setLastAction(`You skipped "${current.title}" 👎`);
    }

    setIndex((prev) => prev + 1);
  };

  const restart = () => {
    setIndex(0);
    setSwipeDirection(null);
    setLastAction(null);
  };

  return (
    <div className="mt-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-5">
        {/* Title / description */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/40 bg-violet-500/10 px-3 py-1 text-[11px] font-medium text-violet-200">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            Solo mode • Filtered by your streaming services
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Swipe through movies on your own
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            We&apos;ll only show movies available on the streaming services you&apos;ve
            selected. Swipe right to like, left to skip. Later we can save your likes
            into a watchlist.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-48">
            <p className="text-sm text-slate-400">Loading your movies…</p>
          </div>
        )}

        {/* Needs services */}
        {!loading && needsServices && (
          <div className="mt-4 rounded-2xl border border-amber-500/60 bg-amber-500/10 px-4 py-4 text-xs sm:text-sm text-amber-100 space-y-2">
            <p className="font-semibold">Pick your streaming services first</p>
            <p>
              To personalize solo mode, we need to know which platforms you&apos;re using.
              Head over to <span className="font-semibold">Pick services</span> and select
              the apps you have (Netflix, Hulu, Disney+, etc).
            </p>
            <a
              href="/preferences"
              className="inline-flex items-center justify-center rounded-full bg-pink-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 transition"
            >
              Go to Pick services
            </a>
          </div>
        )}

        {/* Error (when it's not just "needs services") */}
        {!loading && !needsServices && error && (
          <div className="border border-rose-500/50 bg-rose-500/10 rounded-2xl px-3 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {/* Finished list */}
        {!loading && !needsServices && !error && !current && movies.length > 0 && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              You reached the end of this list. 🎉
            </p>
            {lastAction && (
              <p className="text-xs text-slate-400">{lastAction}</p>
            )}
            <button
              onClick={restart}
              className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 transition"
            >
              Start over
            </button>
          </div>
        )}

        {/* Main swipe card with animation + drag */}
        <AnimatePresence mode="popLayout">
          {!loading && !needsServices && !error && current && (
            <motion.div
              key={current.id}
              className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] items-stretch"
              initial={{ opacity: 0, x: swipeDirection === 'right' ? 80 : -80, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: 0,
                x: swipeDirection === 'right' ? 200 : -200,
                rotate: swipeDirection === 'right' ? 10 : -10,
              }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.x > 80) {
                  handleSwipe('right');
                } else if (info.offset.x < -80) {
                  handleSwipe('left');
                }
              }}
            >
              {/* Poster */}
              <div className="flex items-center justify-center">
                <div className="relative w-40 h-60 sm:w-48 sm:h-72 rounded-3xl overflow-hidden border border-slate-700 bg-slate-800/80 shadow-lg shadow-black/40">
                  {current.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${current.poster_path}`}
                      alt={current.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
                      No poster
                    </div>
                  )}
                </div>
              </div>

              {/* Info + actions */}
              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">{current.title}</h2>
                  <p className="text-xs text-slate-400">
                    ⭐ {current.vote_average?.toFixed(1) ?? '–'} ·{' '}
                    {current.release_date || 'Unknown year'}
                  </p>
                  <p className="text-sm text-slate-200 line-clamp-5">
                    {current.overview || 'No description available.'}
                  </p>
                </div>

                <div className="space-y-2">
                  {lastAction && (
                    <p className="text-[11px] text-slate-400">{lastAction}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSwipe('left')}
                      className="flex-1 rounded-full border border-slate-600 bg-slate-950/70 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-rose-400 hover:text-rose-100 transition"
                    >
                      Skip
                    </button>
                    <button
                      onClick={() => handleSwipe('right')}
                      className="flex-1 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 transition"
                    >
                      Add to likes
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Movie {index + 1} of {movies.length}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
