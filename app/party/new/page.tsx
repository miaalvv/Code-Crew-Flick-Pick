'use client';

import { useState } from 'react';

export default function NewPartyPage() {
  const [name, setName] = useState('Movie Night');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a party name.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/party', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', name: trimmed }),
      });

      const json = await res.json();
      if (!json.ok) {
        setError('Error creating party. Please try again.');
        return;
      }

      window.location.href = `/party/${json.party.id}`;
    } catch (e) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-5">
        {/* Step pill + title */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Step 2 • Create party
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Create a party for your crew
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Give your movie night a name, then share the party link or code with friends so
            everyone can join and start swiping.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="border border-rose-500/50 bg-rose-500/10 rounded-2xl px-3 py-3 text-xs text-rose-100">
            {error}
          </div>
        )}

        {/* Form */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-300">
            Party name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-sm rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            placeholder="Friday Flicks with the Girls"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400">
          <p className="hidden sm:block">
            You&apos;ll get a party page and invite code you can drop in your group chat.
          </p>
          <button
            onClick={create}
            disabled={loading}
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {loading ? 'Creating…' : 'Create party'}
          </button>
        </div>
      </section>
    </div>
  );
}
