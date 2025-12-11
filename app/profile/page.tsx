
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

type Provider = {
  id: number;
  name: string;
  logo_path: string | null;
};

type Genre = {
  genre_id: number;
  genre_name: string;
};

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  {/* Watch Providers */}
  const [services, setServices] = useState<Provider[] | null>(null);
  const [loadingServices, setLoadingServices] = useState(true);

  {/* Genres */}
  const [userGenres, setUserGenres] = useState<Genre[] | null>(null);

  {/* useState<any[]> used as a placeholder until I make a type for each of these prefs */}
  const [userActors, setUserActors] = useState<any[] | null>(null);
  const [userDirectors, setUserDirectors] = useState<any[] | null>(null);
  const [userKeywords, setUserKeywords] = useState<any[] | null>(null);
  const [userDurations, setUserDurations] = useState<any[] | null>(null);
  const [userStudios, setUserStudios] = useState<any[] | null>(null);
  const [userDecades, setUserDecades] = useState<any[] | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = '/login';
          return;
        }

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
          setInitialDisplayName(profile.display_name);
        } else {
          // fall back to prefix of email for the first time
          if (user.email) {
            const prefix = user.email.split('@')[0];
            setDisplayName(prefix);
          }
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load profile.');
      } finally {
        setLoading(false);
      }
 
      {/* ---------- Load and Display TMDB Providers on cards (code from dashboard) ----------*/}

      // 3. Loads TMDB providers
      try {

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = '/login';
          return;
        }
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


            {/* ---------- Loads and displays the user's selected genres on card ---------- */}

            try {
              const {
                data: { user },
              } = await supabase.auth. getUser ();

              if (!user) {
              window.location.href = "/login";
              return;
              }

              {/* Fetch user's saved genres */}

              const { data: genreRows, error: genreError } = await supabase
                .from ("user_genres")
                .select ("genre_id, genre_name")
                .eq ("user_id", user.id);

              if (genreError || !genreRows) {
                setUserGenres ([]);
                return;
              }

              setUserGenres (genreRows);

            } catch (err) {
              console.error (err);
              setUserGenres ([]);
            }


    };

    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const trimmed = displayName.trim();
      if (!trimmed) {
        setError('Display name cannot be empty.');
        setSaving(false);
        return;
      }

      // Upsert into existing profiles table using id + display_name
      const { error: upsertError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          display_name: trimmed,
        },
        { onConflict: 'id' }
      );

      if (upsertError) {
        console.error(upsertError);
        setError('Could not save your display name. Please try again.');
        return;
      }

      setInitialDisplayName(trimmed);
      setMessage('Saved!');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 flex justify-center">
        <p className="text-sm text-slate-400">Loading profile…</p>
      </div>
    );
  }

  {/* Cards and their information - 
    id: card number, title: card title displayed, card_name: short card name, ref: link to specific pref page*/}

  const cards = [
    {id: 1, title: "Watch Providers", card_name: "providers", ref:"/preferences"},
    {id: 2, title: "Genres", card_name: "genres", ref:"/pref_genres"},
    {id: 3, title: "Actors", card_name: "actors", ref:"/pref_actors"},
    {id: 4, title: "Directors", card_name: "directors", ref:"/pref_directors"},
    {id: 5, title: "Keywords", card_name: "keywords", ref:"/pref_keywords"},
    {id: 6, title: "Durations", card_name: "durations", ref:"/pref_durations"},
    {id: 7, title: "Studios", card_name: "studios", ref:"/pref_studios"},
    {id: 8, title: "Decades", card_name: "decades", ref:"/pref_decades"},
  ];


  return (
    <div className="mt-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-6 max-w-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Profile
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Choose how your name appears
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            We&apos;ll use this display name on your dashboard and in parties. You&apos;ll
            still log in with your email magic link.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-200">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              placeholder="e.g. Mia, MovieMia, FlickQueen"
            />
            <p className="text-[11px] text-slate-500">
              This doesn&apos;t affect how you sign in. It&apos;s just how others see you.
            </p>
          </div>

          {error && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/40 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          {message && (
            <p className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/40 rounded-xl px-3 py-2">
              {message}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {saving
                ? 'Saving…'
                : initialDisplayName
                ? 'Update display name'
                : 'Save display name'}
            </button>
          </div>
        </form>
      </section>
      

      {/* User Preferences */}

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Preferences
      </div>
      
      {/* Grid with 3 columns for cards */}
      <div className='mt-4 grid grid-cols-3 gap-6 '>
        {cards.map ((card) => (

          <section key={card.id} className='rounded-3xl bg-slate-900/80 border border-slate-700/70 p-4 shadow-md'>

            {/* flex allows card title and update button to be on same line */}
            <div className='flex items-start'>

              <h2 className='text-lg font-semibold text-slate-100 mb-1'>{card.title}</h2>

              {/* card.ref pulls from const cards to allow each card to link to their own page */}
              <a className='ml-auto rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-60 disabled:cursor-not-allowed transition'
                href={card.ref}>
                Update
              </a>

            </div>

            {/* Displays providers that the user has selected on card */}
            {card.card_name == "providers" && (
              <>
                {loadingServices ? (
                  <p className='text slate-400 text-sm'>Loading providers...</p>
                ) : services && services.length > 0 ? (
                  <div className='flex flex-wrap gap-2 mt-1'>
                    {services.map ((provider) => (
                      <div key = {provider.id} className='flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700'>
                        {provider.logo_path && (
                          <img src = {`https://image.tmdb.org/t/p/w45${provider.logo_path}`}
                          alt = {provider.name}
                          className='h-5'/>
                        )}
                        <span className='text-xs text-slate-300'> {provider.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-slate-400 text-sm'>No Watch Providers Selected</p>
                )}
              </>
            )}
            
            {/* couldnt figure out how to do above part dynamically for each card gonna implement each one individually for now */}

            {/* Displays genres, that the user has selected, on the card */}

            {card.card_name == "genres" && (
              <>
                {!userGenres ? (
                  <p className='text slate-400 text-sm'>Loading genres...</p>
                ) : userGenres.length > 0 ? (
                  <div className='flex flex-wrap gap-2 mt-1'>
                    {userGenres.map ((genre) => (
                      <div key = {genre.genre_id} className='flex items-center gap-2 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700'>
                        <span className='text-xs text-slate-300'> {genre.genre_name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className='text-slate-400 text-sm'>No Genres Selected</p>
                )}
              </>
            )}

          </section>
        ))}

      </div>

    </div>

  );
}

