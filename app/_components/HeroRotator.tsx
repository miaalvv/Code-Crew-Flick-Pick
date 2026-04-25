'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@/app/_hooks/useUser';


type TMDBItem = {
  id: number;
  title?: string;
  name?: string;
  backdrop_path?: string | null;
  poster_path?: string | null;
  trailerKey?: string | null;
  overview?: string | null;
};

type PopularResp = {
  ok: boolean;
  results: TMDBItem[];
};

const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const pickImg = (m: TMDBItem) =>
  m.backdrop_path
    ? `${IMAGE_BASE}/original${m.backdrop_path}`
    : m.poster_path
    ? `${IMAGE_BASE}/w1280${m.poster_path}`
    : null;

export default function HeroRotator() {
  const [items, setItems] = useState<TMDBItem[]>([]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const timerRef = useRef<number | null>(null);
  const { user } = useUser();

  useEffect(() => {
    fetch('/api/tmdb/popular')
      .then((r) => r.json())
      .then((data: PopularResp) => {
        if (data?.ok) {
          const filtered = (data.results ?? []).filter(pickImg);
          setItems(filtered.slice(0, 12));
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!items.length || paused) return;
    timerRef.current = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 5000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [items, paused]);

  const current = items[idx] || null;
  const bg = current ? pickImg(current) : null;
  const title = current?.title ?? current?.name ?? null;
  const overview = current?.overview?.trim();

  const pair = useMemo(() => {
    const prevIdx = (idx - 1 + items.length) % (items.length || 1);
    return [items[prevIdx], items[idx]].filter(Boolean) as TMDBItem[];
  }, [idx, items]);

  useEffect(() => {
    setExpanded(false);
  }, [idx]);

  return (
    <section
      className="relative h-[68vh] w-full overflow-hidden rounded-2xl bg-neutral-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0">
        {pair.map((m, i) => {
          const src = pickImg(m);
          if (!src) return null;
          const isTop = i === pair.length - 1;
          return (
            <div
              key={`${m.id}-${i}`}
              className={`absolute inset-0 transition-opacity duration-700 ${
                isTop ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={src}
                alt={m.title ?? m.name ?? 'Backdrop'}
                fill
                priority={isTop}
                sizes="100vw"
                className="object-cover"
              />
            </div>
          );
        })}
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/60" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="pointer-events-auto absolute top-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setIdx(i)}
            className={`h-2.5 w-2.5 rounded-full transition ${
              i === idx ? 'bg-white' : 'bg-white/50 hover:bg-white/80'
            }`}
          />
        ))}
      </div>

      <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 gap-3">
        <div className="max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight drop-shadow-md">
            {title ?? 'Discover something new'}
          </h1>
        </div>

        {overview && (
          <div className="flex w-full items-start max-w-6xl justify-between gap-3 pr-1 sm:pr-4">
            <div
              className="flex-1 mt-1 text-sm sm:text-base text-slate-100/90 max-w-2xl"
              onMouseEnter={() => setExpanded(true)}
              onMouseLeave={() => setExpanded(false)}
              onFocus={() => setExpanded(true)}
              onBlur={() => setExpanded(false)}
            >
              <p className={`${expanded ? '' : 'line-clamp-2'} leading-relaxed transition-all`}>
                {overview}
              </p>
            </div>

            <div className="flex items-end gap-2 ml-auto">
              {!user ? (
                <>
                  <a
                    href="/login"
                    className="inline-block bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm sm:text-base font-semibold hover:bg-blue-700 transition"
                  >
                    Sign in
                  </a>
                  {/* Play trailer button, falls back to a YouTube search if no trailerKey */}
                  {current && (
                    <a
                      href={
                        current.trailerKey
                          ? `https://www.youtube.com/watch?v=${current.trailerKey}`
                          : title
                          ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} trailer`)}`
                          : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm sm:text-base font-semibold hover:bg-red-700 transition disabled:opacity-60"
                      aria-disabled={!title && !current.trailerKey}
                    >
                      ▶ View trailer
                    </a>
                  )}
                </>
              ) : (
                current && (
                  <a
                    href={
                      current.trailerKey
                        ? `https://www.youtube.com/watch?v=${current.trailerKey}`
                        : title
                        ? `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} trailer`)}`
                        : '#'
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm sm:text-base font-semibold hover:bg-red-700 transition disabled:opacity-60"
                      aria-disabled={!title && !current.trailerKey}
                    >
                      ▶ View trailer
                    </a>
                )
              )}
            </div>
          </div>
        )}
      </div>

      <div className="absolute right-3 top-3 z-10">
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs text-white">
          {paused ? 'Paused' : 'Playing'}
        </span>
      </div>
    </section>
  );
}
