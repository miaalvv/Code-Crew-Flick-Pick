'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        window.location.href = '/dashboard';
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center mt-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
        <h1 className="text-xl font-semibold tracking-tight">Sign In</h1>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Email Address
            </label>
            <input
              type="email"
              className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-300">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleLogin();
                }
              }}
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-300">
              {errorMsg}
            </p>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            className="mt-2 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between text-xs">
            <a
              href="/signup"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              Create Account
            </a>

            <a
              href="/forgot_password"
              className="text-slate-400 hover:text-slate-200 transition"
            >
              Forgot Password?
            </a>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-slate-500">
          By continuing, you agree to let your friends gently judge your movie taste. 🍿
        </p>
      </div>
    </div>
  );
}
