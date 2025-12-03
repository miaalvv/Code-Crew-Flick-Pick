'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

type Profile = {
  id: string;
  display_name: string | null;
};

export default function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      setUserId(user.id);
      await loadFriends(user.id);
      setLoading(false);
    };

    init();
  }, []);

  async function loadFriends(uid: string) {
    // 1) get friend_ids for this user
    const { data: rows, error } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', uid);

    if (error) {
      console.error(error);
      return;
    }

    if (!rows || rows.length === 0) {
      setFriends([]);
      return;
    }

    const friendIds = rows.map((r: { friend_id: string }) => r.friend_id);

    // 2) get profiles for those users
    const { data: profiles, error: profErr } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', friendIds);

    if (profErr) {
      console.error(profErr);
      return;
    }

    setFriends((profiles ?? []) as Profile[]);
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setError(null);
    setMessage(null);

    const trimmed = nameInput.trim();
    if (!trimmed) {
      setError('Enter a display name first.');
      return;
    }

    setSaving(true);

    try {
      // Find a profile with that display_name (exact match)
      const { data: target, error: findErr } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('display_name', trimmed)
        .maybeSingle();

      if (findErr) {
        console.error(findErr);
        setError('Something went wrong looking up that name.');
        return;
      }

      if (!target) {
        setError('No user found with that display name.');
        return;
      }

      if (target.id === userId) {
        setError("That's you! Try a different name.");
        return;
      }

      if (friends.some((f) => f.id === target.id)) {
        setError('You are already friends with this user.');
        return;
      }

      // Insert friendship both ways
      const { error: insertErr } = await supabase.from('friends').insert([
        { user_id: userId, friend_id: target.id },
        { user_id: target.id, friend_id: userId },
      ]);

      if (insertErr) {
        console.error(insertErr);
        setError('Could not add friend. Please try again.');
        return;
      }

      setMessage(`Added ${target.display_name || 'this user'} as a friend.`);
      setNameInput('');
      await loadFriends(userId);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-4 flex justify-center">
        <p className="text-sm text-slate-400">Loading friends…</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6">
      {/* Header */}
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-4 max-w-2xl">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-[11px] font-medium text-sky-200">
            <span className="h-2 w-2 rounded-full bg-sky-400" />
            Friends
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            Your FlickPick friends
          </h1>
          <p className="text-xs sm:text-sm text-slate-300">
            Add friends by their display name so you can join parties together.
            You still log in with your email magic link – this is just how you
            connect in the app.
          </p>
        </div>

        {/* Add friend form */}
        <form onSubmit={handleAddFriend} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-200">
              Friend&apos;s display name
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              placeholder="e.g. alexp3448"
            />
            <p className="text-[11px] text-slate-500">
              They can see or change their display name on the Profile page.
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

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-60 disabled:cursor-not-allowed transition"
          >
            {saving ? 'Adding…' : 'Add friend'}
          </button>
        </form>
      </section>

      {/* Friends list */}
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 max-w-2xl space-y-3">
        <h2 className="text-sm font-semibold text-slate-100">Your friends</h2>
        {friends.length === 0 ? (
          <p className="text-xs text-slate-400">
            You don&apos;t have any friends added yet. Try adding someone by their
            display name above.
          </p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-2xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                    {((f.display_name || '?')[0] || '?').toUpperCase()}
                  </div>
                  <span className="text-slate-100">
                    {f.display_name || 'Unnamed user'}
                  </span>
                </div>
                {/* Room for future: button to invite to party, etc. */}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
