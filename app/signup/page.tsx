'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function SignupPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // If already logged in, go straight to dashboard
    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                window.location.href = '/dashboard';
            }
        });
    }, []);

    const handleSignup = async () => {
        if (!email || !password) return;

        if (password !== confirmPassword) {
            setErrorMsg("Passwords don't match");
            return;
        }

        setLoading(true);
        setErrorMsg(null);

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                setSuccessMsg('Account created! You can now log in.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center mt-6">
            <div className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">

                <h1 className="text-xl font-semibold tracking-tight">
                    Create Account
                </h1>

                <p className="mt-1 text-xs text-slate-400">
                    Sign up with your Email and Password.
                </p>

                <div className="mt-6 space-y-4">

                    {successMsg && (
                        <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
                            {successMsg}
                        </div>
                    )}

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
                        />
                        <p className="mt-1 text-xs text-slate-400">
                            Use at least 8 characters.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                            Confirm Password
                        </label>

                        <input
                            type="password"
                            className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    {errorMsg && (
                        <p className="text-xs text-rose-300">
                            {errorMsg}
                        </p>
                    )}

                    <button
                        onClick={handleSignup}
                        disabled={loading || !email || !password}
                        className="mt-2 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                    >
                        {loading ? 'Creating account…' : 'Create account'}
                    </button>

                    <div className="flex justify-center text-xs text-slate-400">
                        <a
                            href="/login"
                            className="hover:text-slate-200 transition"
                        >
                            Already have an Account? Sign In
                        </a>
                    </div>

                </div>

                <p className="mt-4 text-[11px] text-slate-500">
                    By signing up, you agree to let your friends judge your movie taste. 🍿
                </p>

            </div>
        </div>
    );
}