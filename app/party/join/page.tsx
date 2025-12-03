'use client';

import { useState } from 'react';

export default function JoinPartyPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter a party code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/party', {
        method: 'POST',
        body: JSON.stringify({ action: 'join', invite_code: trimmed }),
      });

      const json = await res.json();
      if (!json.ok) {
        setError('That code doesn&apos;t look right. Double-check and try again.');
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
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Step 3 • Join party
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Enter your party code
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            Your host should send you a short invite code. Pop it in below to join the party
            and start swiping with everyone else.
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
            Party code
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="w-full max-w-xs rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 tracking-[0.3em] uppercase focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
            placeholder="ABC123"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400">
          <p className="hidden sm:block">
            Ask your host to resend the code if you can&apos;t find it.
          </p>
          <button
            onClick={join}
            disabled={loading}
            className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-sky-500/30 hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {loading ? 'Joining…' : 'Join party'}
          </button>
        </div>
      </section>
    </div>
  );
}
