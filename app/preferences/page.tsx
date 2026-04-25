'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../_lib/supabaseClient';
import { useRouter } from 'next/navigation';

type Provider = { id: number; name: string; logo_path: string | null };

export default function PreferencesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ searchTerm, setSearchTerm] = useState('');

  // we want the popular services at the top
  const preferredOrder = useMemo(
    () => ['Netflix', 'Hulu', 'Disney', 'Max', 'Prime', 'Peacock', 'Paramount', 'Apple TV'],
    []
  );

  useEffect(() => {
    (async () => {
      setError('');
      setSaved(false);

      // 1) require auth
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setUserId(user.id);

      // 2) load TMDB providers from API route
      const res = await fetch('/api/tmdb/providers?region=US');
      const json = await res.json();
      if (!json.ok) {
        setError('Failed to load streaming services. Please try again.');
        setLoading(false);
        return;
      }

      let list: Provider[] = json.providers;

      // 3) bubble up the common ones, then sort the rest alphabetically
      const head: Provider[] = [];
      const used = new Set<number>();

      for (const keyword of preferredOrder) {
        const hit = list.find((p) =>
          p.name.toLowerCase().includes(keyword.toLowerCase())
        );
        if (hit && !used.has(hit.id)) {
          head.push(hit);
          used.add(hit.id);
        }
      }

      const tail = list
        .filter((p) => !used.has(p.id))
        .sort((a, b) => a.name.localeCompare(b.name));

      list = [...head, ...tail];
      setProviders(list);

      // 4) load existing selections for this user
      const { data: rows, error: selErr } = await supabase
        .from('user_services')
        .select('provider_id')
        .eq('user_id', user.id);

      if (!selErr && rows) {
        setSelected(new Set(rows.map((r: { provider_id: number }) => r.provider_id)));
      }

      setLoading(false);
    })();
  }, [preferredOrder]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!userId) return;
    setError('');
    setSaving(true);
    setSaved(false);

    // replace choices: delete all, then insert new ones
    const { error: delErr } = await supabase
      .from('user_services')
      .delete()
      .eq('user_id', userId);
    if (delErr) {
      setError(delErr.message);
      setSaving(false);
      return;
    }

    const payload = Array.from(selected).map((provider_id) => {
      const name = providers.find((p) => p.id === provider_id)?.name || '';
      return { user_id: userId, provider_id, provider_name: name };
    });

    if (payload.length > 0) {
      const { error: insErr } = await supabase.from('user_services').insert(payload);
      if (insErr) {
        setError(insErr.message);
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSaved(true);

    // 🔥 NEW: redirect back to profile after successful save
    window.location.href = '/profile';
  };

  const filteredProviders = providers.filter ((provider) => 
        provider.name.toLowerCase ().includes (searchTerm.toLowerCase ())
        );

  // ---------- RENDER ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center mt-10">
        <p className="text-sm text-slate-400">Loading your streaming services…</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-5">
        {/* Step pill + title */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              Step 1 • Pick services
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Choose your streaming services
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              We&apos;ll use this list to only show you movies and shows available where you
              actually watch. You can change this anytime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                document.getElementById('save-services')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
              className="hidden sm:inline-flex items-center gap-2 rounded-full border border-pink-500/50 bg-pink-500/15 px-3.5 py-1.5 text-[11px] font-semibold text-pink-100 hover:border-pink-400 hover:bg-pink-500/25 transition"
            >
              <span className="text-sm font-bold leading-none">↓</span>
              Go to save
            </button>
            {saved && (
              <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                Saved ✓
              </span>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="border border-rose-500/50 bg-rose-500/10 rounded-2xl px-3 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

         {/* Search Bar */}

        <div className="mb-4 flex flex-wrap sm:flex-nowrap gap-2 items-center">
            <input 
                type="text"
                placeholder="Search for providers"
                className="flex-1 min-w-0 rounded-lg border bg-slate-800/60 p-2 text-slate-100 focus:outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm (e.target.value)}
            />
        </div>

        {/* Providers grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {filteredProviders.map((p) => {
            const on = selected.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left text-xs sm:text-sm transition ${
                  on
                    ? 'bg-white/10 border-white shadow-md shadow-black/30'
                    : 'border-white/20 hover:border-white/60 hover:bg-white/5'
                }`}
                aria-pressed={on}
              >
                {p.logo_path ? (
                  <Image
                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                    alt={p.name}
                    width={28}
                    height={28}
                    className="rounded-md bg-slate-800/70"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-md bg-white/15" />
                )}
                <span className="truncate">{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Save area */}
        <div
          id="save-services"
          className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400"
        >
          <p className="hidden sm:block">
            Pro tip: pick the services your whole friend group has in common for the best matches.
          </p>
      
        </div>
      </section>

      <div className="sticky bottom-0 bg-background/80 backdrop-blur-xs border-t border-white/20 p-3 flex items-center justify-end rounded-md">
                <button
                    onClick={save}
                    disabled={saving}
                    className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                >
                    {saving ? 'Saving…' : 'Save Services'}
                </button>
            </div>
            
    </div>
  );
}
