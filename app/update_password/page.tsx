'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setReady(true);
            }
        });

        supabase.auth.getSession().then(({ data }) => {
            if (data.session) {
                setReady(true);
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const handleUpdatePassword = async () => {
        if (!password || !confirmPassword) return;

        if (password !== confirmPassword) {
            setErrorMsg("Passwords don't match");
            return;
        }

        setLoading(true);
        setErrorMsg(null);
        setSuccessMsg(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password,
            });

            if (error) {
                setErrorMsg(error.message);
            } else {
                setSuccessMsg('Password updated successfully. Redirecting to login...');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 1500);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center mt-6">
            <div className="w-full max-w-md rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-2xl shadow-black/40 backdrop-blur">
                <h1 className="text-xl font-semibold tracking-tight">Set a New Password</h1>

                <p className="mt-1 text-xs text-slate-400">
                    Choose a new password for your account.
                </p>

                <div className="mt-6 space-y-4">
                    {!ready ? (
                        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 px-3 py-3 text-xs text-amber-100">
                            Open this page from the password reset link in your email.
                        </div>
                    ) : (
                        <>
                            {successMsg && (
                                <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-3 text-xs text-emerald-100">
                                    {successMsg}
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-slate-300">
                                    New Password
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-slate-300">
                                    Confirm New Password
                                </label>
                                <input
                                    type="password"
                                    className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-pink-500 focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleUpdatePassword();
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
                                onClick={handleUpdatePassword}
                                disabled={loading || !password || !confirmPassword}
                                className="mt-2 w-full rounded-full bg-pink-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                            >
                                {loading ? 'Updating password…' : 'Update password'}
                            </button>
                        </>
                    )}
                </div>

                <p className="mt-4 text-[11px] text-slate-500">
                    Once updated, use your new password to sign in. 🍿
                </p>
            </div>
        </div>
    );
}