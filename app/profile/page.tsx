'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function ProfilePage() {
  const [displayName, setDisplayName] = useState('');
  const [initialDisplayName, setInitialDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    </div>
  );
}
