'use client';

import { useEffect, useState } from "react";
import { supabase } from '../_lib/supabaseClient';

export default function DurationPreferencePage () {

    const [ loading, setLoading] = useState (true);
    const [ userId, setUserId] = useState<string | null>(null);
    const [ minDur, setMinDur] = useState<number>(0);
    const [ maxDur, setMaxDur] = useState<number>(300);
    const [ error, setError] = useState('');
    const [ saving, setSaving] = useState(false);
    const [ saved, setSaved] = useState(false);

    useEffect (() => {
        (async () => {
            setError ('');
            setSaved (false);

            {/* makes sure user is logged in - auth required */}
            
            const {
                data : { user }
            } = await supabase.auth.getUser ();

            if (!user) {
                window.location.href = '/login';
                return;
            }

            setUserId (user.id);

            {/* Loads user's saved duration selection */}

            const { data: rows, error: selError } = await supabase
                .from ("user_durations")
                .select ("min_duration, max_duration")
                .eq ("user_id", user.id)
                .single ()

            if (!selError && rows) {
                setMinDur (rows.min_duration ?? 0);
                setMaxDur (rows.max_duration ?? 300);
            }

            setLoading (false);
        }) ();
}, []);

    {/* Save selection to data table */}

     const save = async () => {
        if (!userId) return;

        setError ('');
        setSaving (true);
        setSaved (false);

        {/* Prevents min from being greater than max*/}

        if (minDur > maxDur) {
            setError ("Minimum duration cannot be greater than maximum duration");
            setSaving (false);
            return;
        }

        {/* Clears existing rows */}
        
        const { error: delError} = await supabase
            .from ("user_durations")
            .delete ()
            .eq ("user_id", userId);

        if (delError) {
            setError (delError.message);
            setSaving (false);
            return;
        }

        {/* Inserts new rows to the table */}

        const { error: insError } = await supabase
            .from ("user_durations")
            .insert ({
                user_id: userId,
                min_duration: minDur,
                max_duration: maxDur
            });

        if (insError) {
            setError (insError.message);
            setSaving (false);
            return;
        }

        setSaving (false);
        setSaved (true);

        {/* redirects back to the profile page */}

        window.location.href = "/profile";
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center mt-10">

                <p className="text-sm text-slate-400"> Loading your durations...</p>

            </div>
        );
    }

    return (
        <div className="mt-4">
            <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-5">

                <div className="flex items-start justify-between gap-4">
                    <div className="space y-2">
                        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">

                            <span className="h-2 w-2 rounded-full bg-pink-400" />
                            Pick Duration Range

                        </div>

                        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
                            Choose your preferred movie lengths
                        </h1>

                        <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-xl">
                            We&apos;ll recommend movies with runtimes between the range you select.
                        </p>

                    </div>

                    {saved && (
                        <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                            Saved
                        </span>
                    )}
                </div>

                {/* Error message */}

                {error && (
                    <div className="border border-rose-500/50 bg-rose-500/10 rounded-2xl px-3 py-3 text-xs text-rose-100">
                        {error}
                    </div>
                )}

                {/* Duration Selection */}

                <div className="space-y-4">

                    <div className="flex flex-col gap-2">

                        <label className="text-xs text-slate-300">
                            Minimum Duration (minutes)
                        </label>

                        <input 
                            type = "number"
                            value = {minDur}
                            onChange = {(e) => setMinDur (Number (e.target.value))}
                            min = {0}
                            max = {maxDur}
                            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                        />

                    </div>

                    <div className="flex flex-col gap-2">

                        <label className="text-xs text-slate-300">
                            Maximum Duration (minutes)
                        </label>

                        <input 
                            type = "number"
                            value = {maxDur}
                            onChange = {(e) => setMaxDur (Number (e.target.value))}
                            min = {minDur}
                            max = {300}
                            className="rounded-xl bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                        />

                    </div>

                </div>

                {/* Save button */}

                <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400">

                    <p className="hidden sm:block">
                        Pick a duration range to filter movies within your range. 
                    </p>

                    <button
                        onClick={save}
                        disabled={saving}
                        className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                    >
                        {saving ? 'Saving…' : 'Save duration'}
                    </button>

                </div>

            </section>
        </div>
    );

}