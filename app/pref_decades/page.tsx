'use client';

import { useEffect, useState } from "react";
import { supabase } from '../_lib/supabaseClient';

type Decade = {
    label: string;
    start: number;
    end: number;
};

export default function DecadePreferencePage () {

    const [ loading, setLoading] = useState (true);
    const [ userId, setUserId] = useState<string | null>(null);
    const [ decades, setDecades] = useState<Decade[]>();
    const [ selected, setSelected] = useState<Set<string>>(new Set ());
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

            {/* Fetch decades */}

            const res = await fetch ("/api/tmdb/decades");
            const json = await res.json ();

            if (!json.ok) {
                setError ("Failed to load decades");
                setLoading (false);
                return;
            }

            const list: Decade [] = json.decades;
            setDecades (list);

            {/* Loads user selections */}

            const { data: rows, error: selError } = await supabase
                .from ("user_decades")
                .select ("decade_label")
                .eq ("user_id", user.id);
            
            if (!selError && rows) {
                setSelected (
                    new Set (rows.map ((r: { decade_label: string }) => r.decade_label))
                );
            }

            setLoading (false)

        }) ();
    }, []);

    const toggle = (label: string) => {
        setSelected ((prev) => {
            const next = new Set (prev);
            next.has (label) ? next.delete (label) : next.add (label);
            return next;
        });
    };

    {/* Saves user selections */}

    const save = async () => {
        if (!userId) return;

        setError ("");
        setSaving (true);
        setSaved (false);

        {/* Clears selections */}

        const { error: delError } = await supabase
            .from ("user_decades")
            .delete ()
            .eq ("user_id", userId);

        if (delError) {
            setError (delError.message);
            setSaving (false);
            return;
        }

        const payload = Array.from (selected).map ((label) => {
            const decade = decades?.find ((d) => d.label === label);

            return {
                user_id: userId,
                decade_label: label,
                start_year: decade?.start || null,
                end_year: decade?.end || null,
            };
        });

        if (payload.length > 0) {
            const { error: insError } = await supabase
                .from ("user_decades")
                .insert (payload);

            if (insError) {
                setError (insError.message);
                setSaving (false);
                return;
            }
        }   

        setSaving (false);
        setSaved (true);

        {/* Redirect back to profile */}

        window.location.href = "/profile";
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center mt-10">
                <p className="text-sm text-slate-400">Loading your decades...</p>
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
                            Pick Decades

                        </div>

                        <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
                            Choose your favorite decades
                        </h1>

                        <p className="mt-2 text-xs sm:text-sm text-slate-300 max-w-xl">
                            We&apos;ll filter movies based on your favorite decades.
                        </p>

                    </div>

                    {saved && (
                        <span className="rounded-full border border-emerald-400/60 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                            Saved
                        </span>
                    )}
                </div>

                {/* Error message in case error is thrown */}

                {error && (
                    <div className="border border-rose-500/50 bg-rose-500/10 rounded-2xl px-3 py-3 text-xs text-rose-100">
                        {error}
                    </div>
                )}

                {/* Decade selection grid */}

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {decades?.map ((d) => {
                        const on = selected.has (d.label);
                        return (
                            <button
                                key={d.label}
                                type="button"
                                onClick={() => toggle(d.label)}
                                className={`flex items-center gap-3 rounded-2xl border px-3 py-2 text-left text-xs sm:text-sm transition ${
                                on
                                    ? 'bg-white/10 border-white shadow-md shadow-black/30'
                                    : 'border-white/20 hover:border-white/60 hover:bg-white/5'
                                }`}
                            >
                                <span className="truncate">{d.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Section for the save button */}
                
                <div className="flex items-center justify-between gap-3 pt-2 text-xs text-slate-400">

                    <p className="hidden sm:block">
                        Pick your favorite decades to see movies from those years. 
                    </p>

                    <button
                        onClick={save}
                        disabled={saving}
                        className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-60 transition"
                    >
                        {saving ? 'Saving…' : 'Save decades'}
                    </button>

                </div>

            </section>
        </div>
    )

}