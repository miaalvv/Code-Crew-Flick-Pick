'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If already logged in, go straight to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        window.location.href = '/dashboard';
      }
    });
  }, []);

  const sendLink = async () => {
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center mt-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">Sign in to FlickPick</h1>
        <p className="mt-1 text-xs text-slate-400">
          We use passwordless magic links – enter your email and we&apos;ll send you a sign-in link.
        </p>

        <div className="mt-6 space-y-4">
          {sent ? (
            <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
              Magic link sent to <span className="font-semibold">{email}</span>.  
              Check your inbox (and spam folder) to continue.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-300">
                  Email address
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-300">
                  {errorMsg}
                </p>
              )}

              <button
                onClick={sendLink}
                disabled={loading || !email}
                className="mt-2 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
              >
                {loading ? 'Sending magic link…' : 'Send magic link'}
              </button>
            </>
          )}
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          By continuing, you agree to let your friends gently judge your movie taste. 🍿
        </p>
      </div>
    </div>
  );
}
