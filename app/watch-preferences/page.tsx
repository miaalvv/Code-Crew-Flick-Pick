'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '../_lib/supabaseClient';

type PillItem = { label: string; image?: string | null };

type TileSummary = {
  href: string;
  label: string;
  desc: string;
  summary: string;
  items: PillItem[];
};

export default function WatchPreferencesPage() {
  const router = useRouter();
  const [tiles, setTiles] = useState<TileSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadTiles = async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    const fetchNames = async (table: string, column: string, limit = 3) => {
      const { data, error } = await supabase
        .from(table)
        .select(column)
        .eq('user_id', user.id)
        .limit(limit);

      if (error) {
        console.error(error);
        return [];
      }

      return ((data ?? []) as unknown as Record<string, string>[])
        .map((r) => r[column])
        .filter((value): value is string => Boolean(value));
    };

    const fetchDuration = async () => {
      const { data, error } = await supabase
        .from('user_durations')
        .select('min_duration, max_duration')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error(error);
        return null;
      }

      return data;
    };

    const fetchCount = async (table: string) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (error) {
        console.error(error);
        return 0;
      }

      return count ?? 0;
    };

    const fmt = (items: string[]) =>
      items.length === 0
        ? 'Not set'
        : items.slice(0, 3).join(', ') +
          (items.length > 3 ? ` +${items.length - 3}` : '');

    const genres = await fetchNames('user_genres', 'genre_name');
    const actors = await fetchNames('user_actors', 'actor_name');
    const directors = await fetchNames('user_directors', 'director_name');
    const keywords = await fetchNames('user_keywords', 'keyword_name');
    const studios = await fetchNames('user_studios', 'studio_name');
    const dur = await fetchDuration();
    const decadesCount = await fetchCount('user_decades');

    const tilesData: TileSummary[] = [
      {
        href: '/pref_genres',
        label: 'Genres',
        desc: 'Choose your favorite genres.',
        summary: fmt(genres),
        items: genres.slice(0, 3).map((g) => ({ label: g })),
      },
      {
        href: '/pref_actors',
        label: 'Actors',
        desc: 'Star the actors you like watching.',
        summary: fmt(actors),
        items: actors.slice(0, 3).map((a) => ({ label: a })),
      },
      {
        href: '/pref_directors',
        label: 'Directors',
        desc: 'Prioritize directors you enjoy.',
        summary: fmt(directors),
        items: directors.slice(0, 3).map((d) => ({ label: d })),
      },
      {
        href: '/pref_keywords',
        label: 'Keywords',
        desc: 'Themes or vibes you want to see.',
        summary: fmt(keywords),
        items: keywords.slice(0, 3).map((k) => ({ label: k })),
      },
      {
        href: '/pref_durations',
        label: 'Duration',
        desc: 'Set your preferred runtime range.',
        summary:
          dur?.min_duration != null && dur?.max_duration != null
            ? `${dur.min_duration}-${dur.max_duration} min`
            : 'Not set',
        items:
          dur?.min_duration != null && dur?.max_duration != null
            ? [{ label: `${dur.min_duration}-${dur.max_duration} min` }]
            : [],
      },
      {
        href: '/pref_studios',
        label: 'Studios',
        desc: 'Studios you trust for good picks.',
        summary: fmt(studios),
        items: studios.slice(0, 3).map((s) => ({ label: s })),
      },
      {
        href: '/pref_decades',
        label: 'Decades',
        desc: 'Eras you’re in the mood for.',
        summary: decadesCount > 0 ? `${decadesCount} selected` : 'Not set',
        items: decadesCount > 0 ? [{ label: `${decadesCount} selected` }] : [],
      },
    ];

    setTiles(tilesData);
    setLoading(false);
  };

  useEffect(() => {
    loadTiles().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetAll = async () => {
    setResetting(true);
    setResetMessage(null);
    setConfirmOpen(false);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const tables = [
        // exclude user_services from reset
        'user_genres',
        'user_actors',
        'user_directors',
        'user_keywords',
        'user_studios',
        'user_decades',
        'user_durations',
      ];

      for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', user.id);
        if (error) throw error;
      }

      setResetMessage('Preferences reset. You can set them again below.');
      await loadTiles();
    } catch (err) {
      console.error(err);
      setResetMessage('Reset failed. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const displayTiles: TileSummary[] = loading
    ? Array.from({ length: 6 }, (_, idx) => ({
        href: `loading-${idx}`,
        label: 'Loading…',
        desc: 'Loading preferences…',
        summary: 'Fetching saved choices…',
        items: [],
      }))
    : tiles;

  return (
    <div className="mt-1.5 space-y-6">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => {
            router.push('/dashboard');
          }}
          className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-[11px] font-semibold text-slate-100 shadow-sm transition hover:bg-slate-700"
        >
          ← Back
        </button>

        <button
          onClick={() => setConfirmOpen(true)}
          disabled={resetting}
          className="inline-flex items-center rounded-full border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-[11px] font-semibold text-rose-100 shadow-sm shadow-rose-500/20 transition hover:border-rose-400 hover:bg-rose-500/20 disabled:opacity-60"
        >
          {resetting ? 'Resetting…' : 'Reset all preferences'}
        </button>

        {resetMessage && (
          <span className="text-[11px] text-slate-200">{resetMessage}</span>
        )}
      </div>

      <section className="space-y-3 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Preferences Hub
        </div>

        <h1 className="text-2xl font-semibold text-slate-50">
          Tune your watch preferences
        </h1>

        <p className="max-w-2xl text-sm text-slate-300">
          Update any category below to keep recommendations and party matches aligned with what you actually want to watch.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {displayTiles.map((tile, idx) => (
          <a
            key={tile.href || idx}
            href={loading ? '#' : tile.href}
            className="group rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm shadow transition hover:border-pink-400 hover:bg-slate-900/80"
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold text-slate-50">
                {tile.label}
              </div>
              <span className="text-[11px] text-pink-200">
                {loading ? '...' : 'Edit →'}
              </span>
            </div>

            <p className="mt-2 text-xs text-slate-300">{tile.desc}</p>

            <p className="mt-3 text-[11px] text-slate-200">
              {tile.summary}
            </p>

            {tile.items.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {tile.items.map((item, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-slate-100"
                  >
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.label}
                        width={18}
                        height={18}
                        className="rounded-sm bg-slate-800/70"
                      />
                    ) : null}

                    <span className="truncate">{item.label}</span>
                  </span>
                ))}
              </div>
            )}
          </a>
        ))}
      </section>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900/90 p-6 shadow-2xl shadow-black/50">
            <h3 className="text-lg font-semibold text-slate-50">
              Reset preferences?
            </h3>

            <p className="mt-2 text-sm text-slate-300">
              This will clear your genres, actors, directors, keywords, durations,
              studios, and decades. Your streaming services will stay saved.
            </p>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={resetAll}
                disabled={resetting}
                className="inline-flex items-center rounded-full bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/30 transition hover:bg-rose-400 disabled:opacity-60"
              >
                {resetting ? 'Resetting…' : 'Yes, reset'}
              </button>

              <button
                onClick={() => setConfirmOpen(false)}
                disabled={resetting}
                className="inline-flex items-center rounded-full border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}