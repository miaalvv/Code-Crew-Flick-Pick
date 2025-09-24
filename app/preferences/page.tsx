'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../_lib/supabaseClient';

type Provider = { id: number; name: string; logo_path: string | null };

export default function PreferencesPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');

  // surface common providers first if present
  const preferredOrder = useMemo(
    () => ['Netflix', 'Hulu', 'Disney', 'Max', 'Prime', 'Peacock', 'Paramount', 'Apple TV'],
    []
  );

  useEffect(() => {
    (async () => {
      setError('');
      // auth required
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setUserId(user.id);

      // load TMDB providers (server route)
      const res = await fetch('/api/tmdb/providers?region=US');
      const json = await res.json();
      if (!json.ok) {
        setError('Failed to load providers.');
        setLoading(false);
        return;
      }

      let list: Provider[] = json.providers;

      // Reorder to bubble common ones, then append the rest
      const head: Provider[] = [];
      const used = new Set<number>();
      for (const keyword of preferredOrder) {
        const hit = list.find((p) => p.name.toLowerCase().includes(keyword.toLowerCase()));
        if (hit && !used.has(hit.id)) {
          head.push(hit);
          used.add(hit.id);
        }
      }
      const tail = list.filter((p) => !used.has(p.id)).sort((a, b) => a.name.localeCompare(b.name));
      list = [...head, ...tail];

      setProviders(list);

      // load my existing selections
      const { data: rows, error: selErr } = await supabase
        .from('user_services')
        .select('provider_id')
        .eq('user_id', user.id);

      if (!selErr && rows) {
        setSelected(new Set(rows.map((r) => r.provider_id)));
      }

      setLoading(false);
    })();
  }, [preferredOrder]);

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (!userId) return;
    setError('');

    // Replace choices: delete old, insert new
    const { error: delErr } = await supabase.from('user_services').delete().eq('user_id', userId);
    if (delErr) { setError(delErr.message); return; }

    const payload = Array.from(selected).map((provider_id) => {
      const name = providers.find((p) => p.id === provider_id)?.name || '';
      return { user_id: userId, provider_id, provider_name: name };
    });

    if (payload.length > 0) {
      const { error: insErr } = await supabase.from('user_services').insert(payload);
      if (insErr) { setError(insErr.message); return; }
    }

    alert('Saved!');
    window.location.href = '/dashboard';
  };

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Choose your streaming services</h1>
        <p className="opacity-80">These filter what we show you when swiping with friends.</p>
      </div>

      {error && (
        <div className="border border-red-500/50 bg-red-500/10 rounded p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {providers.map((p) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={`flex items-center gap-3 border rounded px-3 py-2 text-left transition ${
                on ? 'bg-white/10 border-white' : 'border-white/30 hover:border-white/60'
              }`}
              aria-pressed={on}
            >
              {p.logo_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                  alt={p.name}
                  width={28}
                  height={28}
                />
              ) : (
                <div className="w-7 h-7 rounded bg-white/20" />
              )}
              <span className="truncate">{p.name}</span>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <button onClick={save} className="rounded border px-4 py-2">Save</button>
      </div>
    </main>
  );
}
