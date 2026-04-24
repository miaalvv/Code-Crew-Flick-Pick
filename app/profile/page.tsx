
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

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
          .select('display_name, avatar_url')
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
        if (profile?.avatar_url) {
          setAvatarUrl(profile.avatar_url);
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

  const handleAvatarUpload = async () => {
    if (!avatarFile) {
      setAvatarError('Please choose an image file first.');
      return;
    }
    setAvatarError(null);
    setAvatarMessage(null);
    setAvatarUploading(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const fileExt = avatarFile.name.split('.').pop();
      const path = `${user.id}-${Date.now()}.${fileExt ?? 'jpg'}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = publicUrlData.publicUrl;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      setAvatarMessage('Avatar updated!');
    } catch (err: any) {
      console.error(err);
      setAvatarError(err.message ?? 'Failed to upload avatar.');
    } finally {
      setAvatarUploading(false);
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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <section className="flex-1 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-6 w-full max-w-xl">
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
              still log in with your email.
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-200">Display name</label>
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

        <section className="flex-1 rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-4 w-full max-w-xl">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              Avatar
            </div>
            <h2 className="text-lg font-semibold text-slate-100">Upload your avatar</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              This image will show in the app header and parties. Square images look best.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div className="flex justify-center sm:justify-start">
              <div className="w-full max-w-[220px] aspect-square rounded-full border border-slate-700 bg-slate-800 overflow-hidden flex items-center justify-center text-slate-300 text-2xl">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  (displayName || '🙂')[0]
                )}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              <p className="text-sm text-slate-300">
                Pick an image, then save it to update your avatar across the app.
              </p>
              {avatarFile && <p className="text-xs text-slate-400 truncate">{avatarFile.name}</p>}
              {avatarMessage && <span className="block text-xs text-emerald-300">{avatarMessage}</span>}
              {avatarError && <span className="block text-xs text-rose-300">{avatarError}</span>}
            </div>
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
                className="block w-full text-xs text-slate-200 file:mr-3 file:rounded-full file:border-0 file:bg-pink-500 file:px-3 file:py-1.5 file:text-[11px] file:font-semibold file:text-white file:hover:bg-pink-400 sm:max-w-sm"
              />
              <button
                type="button"
                onClick={handleAvatarUpload}
                disabled={avatarUploading}
                className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-60 disabled:cursor-not-allowed transition sm:self-end"
              >
                {avatarUploading ? 'Uploading…' : 'Save avatar'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
