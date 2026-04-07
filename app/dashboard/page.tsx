'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../_lib/supabaseClient';

type Provider = {
  id: number;
  name: string;
  logo_path: string | null;
};

type FavoritePreview = {
  movie_id: number;
  title: string | null;
  poster_path: string | null;
};

export default function DashboardPage() {
  const [loadingUser, setLoadingUser] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  const [services, setServices] = useState<Provider[] | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);
  const [favorites, setFavorites] = useState<FavoritePreview[] | null>(null);
  const [loadingFavorites, setLoadingFavorites] = useState(true);

  useEffect(() => {
    (async () => {
      // 1) Check auth via Supabase
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      setEmail(user.email ?? null);
      setLoadingUser(false);

      // 2) Load profile (display_name)
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error(profileError);
        }

        if (profile?.display_name) {
          setDisplayName(profile.display_name);
        }
      } catch (err) {
        console.error(err);
      }

      // 3) Load TMDB providers
      try {
        const res = await fetch('/api/tmdb/providers?region=US');
        const json = await res.json();

        if (!json.ok) {
          setServices([]);
          setLoadingServices(false);
          return;
        }

        const allProviders: Provider[] = json.providers;

        // 4) Load this user's saved services from Supabase
        const { data: rows, error } = await supabase
          .from('user_services')
          .select('provider_id')
          .eq('user_id', user.id);

        if (error || !rows) {
          setServices([]);
          setLoadingServices(false);
          return;
        }

        const ids = rows.map((r: { provider_id: number }) => r.provider_id);
        const selectedProviders = allProviders.filter((p) => ids.includes(p.id));

        setServices(selectedProviders);
        setLoadingServices(false);
      } catch (err) {
        console.error(err);
        setServices([]);
        setLoadingServices(false);
      }

      // 4) Load a few favorites for preview
      try {
        const { data: favs, error: favErr } = await supabase
          .from('favorites')
          .select('movie_id, title, poster_path')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (favErr) {
          console.error(favErr);
          setFavorites([]);
        } else {
          setFavorites(favs as FavoritePreview[]);
        }
      } catch (err) {
        console.error(err);
        setFavorites([]);
      } finally {
        setLoadingFavorites(false);
      }
    })();
  }, []);

  if (loadingUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-400">Loading dashboard…</p>
      </div>
    );
  }

  // Fallback: display_name → email prefix → email → "friend"
  let greetingName: string = 'friend';
  if (displayName) {
    greetingName = displayName;
  } else if (email) {
    greetingName = email.split('@')[0];
  }

  return (
    <div className="space-y-6 mt-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-5">
        {/* Top: welcome + mini profile */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back, {greetingName} 
            </h1>
            <p className="mt-2 text-sm text-slate-300 max-w-xl">
              Create a party, invite your friends, and start swiping through movies together.
              We&apos;ll find the overlaps so everyone is happy.
            </p>

            <a
              href="/profile"
              className="mt-2 inline-flex text-[11px] text-pink-300 hover:text-pink-200 underline decoration-pink-400/70"
            >
              Edit your display name →
            </a>
          </div>

          {/* Profile-ish box with services */}
          <div className="flex flex-col gap-3 min-w-[220px]">
            <a
              href="/preferences"
              className="block rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-xs text-slate-200 hover:border-pink-400 hover:bg-slate-900/80 transition"
            >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-50">Your streaming profile</span>
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/12 border border-white/15">
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-80"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </span>
              {loadingServices && (
                <span className="text-[11px] text-slate-500">Loading…</span>
              )}
            </div>

              {!loadingServices && (!services || services.length === 0) && (
                <p className="mt-2 text-[11px] text-slate-400">
                  You haven&apos;t picked any services yet. Start with Step 1: Pick services.
                </p>
              )}

              {!loadingServices && services && services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {services.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-2.5 py-1.5"
                    >
                      {p.logo_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                          alt={p.name}
                          width={22}
                          height={22}
                          className="rounded-md bg-slate-800/70"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-md bg-white/10" />
                      )}
                      <span className="text-[11px] sm:text-xs">{p.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </a>
          </div>
        </div>

        {/* Step + Solo tiles */}
        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          <a
            href="/preferences"
            className="group rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm shadow hover:border-pink-400 hover:bg-slate-900/80 transition"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Step 1
            </div>
            <div className="font-semibold">Pick services</div>
            <p className="mt-1 text-xs text-slate-400">
              Tell FlickPick which streaming services your group has.
            </p>
          </a>

          <a
            href="/party/new"
            className="group rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm shadow hover:border-emerald-400 hover:bg-slate-900/80 transition"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Step 2
            </div>
            <div className="font-semibold">Create a party</div>
            <p className="mt-1 text-xs text-slate-400">
              Generate a party code and share it with friends.
            </p>
          </a>

          <a
            href="/party/join"
            className="group rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm shadow hover:border-sky-400 hover:bg-slate-900/80 transition"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Step 3
            </div>
            <div className="font-semibold">Join a party</div>
            <p className="mt-1 text-xs text-slate-400">
              Enter a party code to start swiping with your crew.
            </p>
          </a>

          <a
            href="/solo"
            className="group rounded-2xl border border-slate-700 bg-slate-950/40 p-4 text-sm shadow hover:border-violet-400 hover:bg-slate-900/80 transition"
          >
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Solo
            </div>
            <div className="font-semibold">Swipe by yourself</div>
            <p className="mt-1 text-xs text-slate-400">
              Browse popular movies on your own and get a feel for the matches you like.
            </p>
          </a>
        </div>
      </section>
          {/* Friends + Favorites row */}
    <div className="mt-6 flex flex-col lg:flex-row gap-4">
      <section className="w-full lg:max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 flex flex-col">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Social
          </div>
          <h2 className="text-lg font-semibold text-slate-50">Friends</h2>
          <p className="text-sm text-slate-300">
            Add friends by their display name so you can join parties together.
          </p>
        </div>

        <div className="mt-auto pt-4 flex">
          <a
            href="/friends"
            className="inline-flex items-center rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 transition"
          >
            Open friends page
          </a>
        </div>
      </section>

      <section className="flex-1 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 flex flex-col">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
            <span className="h-2 w-2 rounded-full bg-pink-400" />
            Favorites
          </div>
          <h2 className="text-lg font-semibold text-slate-50">Favorited movies</h2>
          <p className="text-sm text-slate-300">
            Quickly jump to the titles you loved.
          </p>
        </div>

        <div className="mt-4 flex-1 flex flex-wrap items-start gap-3">
          {!loadingFavorites && favorites && favorites.length > 0 && (
            <div className="flex items-center gap-2">
              {favorites.map((f) => (
                <div
                  key={f.movie_id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-white/5 shadow-sm shadow-black/30"
                  title={f.title || undefined}
                >
                  {f.poster_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w154${f.poster_path}`}
                      alt={f.title || 'Favorite movie'}
                      width={64}
                      height={96}
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-16 h-24 bg-slate-800/70 flex items-center justify-center text-[10px] text-slate-400 px-1">
                      {f.title || 'Movie'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!loadingFavorites && favorites && favorites.length === 0 && (
            <span className="text-[11px] text-slate-400">No favorites yet.</span>
          )}
          {loadingFavorites && (
            <span className="text-[11px] text-slate-500">Loading favorites…</span>
          )}
        </div>

        <div className="mt-auto pt-4 flex">
          <a
            href="/favorites"
            className="inline-flex items-center rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 transition"
          >
            View favorites
          </a>
        </div>
      </section>
    </div>

    <section className="mt-4 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Preferences
          </div>
          <h2 className="text-lg font-semibold text-slate-50">Movie preferences</h2>
          <p className="text-sm text-slate-300 max-w-3xl">
            Jump to your personalize profile page to update genres, actors, directors, keywords,
            durations, studios, and decades—so recommendations match what you love.
          </p>
        </div>

        <div className="mt-4">
          <a
            href="/watch-preferences"
            className="inline-flex items-center rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 transition"
          >
            Open watch preferences
          </a>
        </div>
      </section>

    </div>
  );
}
