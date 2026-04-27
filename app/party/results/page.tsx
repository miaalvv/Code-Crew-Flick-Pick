// app/party/results/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { supabase as globalSupabase } from "@/app/_lib/supabaseClient";

const supabase =
  globalSupabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  like_count: number;
};

type PartyRow = {
  session_state: string | null;
  results_started_at: string | null;
  current_round_num: number | null;
};

export default function PartyResults() {
  const params = useSearchParams();
  const router = useRouter();

  const party_id = params.get("party") ?? "";
  const roundParam = params.get("round") ?? "";

  const [matches, setMatches] = useState<Match[]>([]);
  const [party, setParty] = useState<PartyRow | null>(null);
  const [roundId, setRoundId] = useState<string | null>(roundParam || null);
  const [isHost, setIsHost] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const durationSeconds = 30;

  const secondsLeft = useMemo(() => {
    const started = party?.results_started_at;
    if (!started) return durationSeconds;
    const startedMs = new Date(started).getTime();
    const elapsed = (now - startedMs) / 1000;
    return Math.max(0, Math.ceil(durationSeconds - elapsed));
  }, [party?.results_started_at, now]);
  const progressPct = useMemo(
    () => Math.max(0, Math.min(100, ((durationSeconds - secondsLeft) / durationSeconds) * 100)),
    [secondsLeft]
  );

  // Load party + host
  useEffect(() => {
    if (!party_id) return;

    (async () => {
      const { data: partyRow } = await supabase
        .from("parties")
        .select("session_state, results_started_at, current_round_num")
        .eq("id", party_id)
        .maybeSingle();

      setParty(partyRow ?? null);

      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) return;

      const { data: pm } = await supabase
        .from("party_members")
        .select("role")
        .eq("party_id", party_id)
        .eq("user_id", uid)
        .maybeSingle();

      setIsHost(pm?.role === "host");
    })();
  }, [party_id]);

  // Fetch matches (now using round_id!)
  useEffect(() => {
    if (!party_id || !roundId) return;

    (async () => {
      try {
        const res = await fetch("/api/swipes/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ party_id, round_id: roundId }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load matches");

        setMatches(data.matches ?? []);
      } catch (e: any) {
        setError(e.message ?? "Failed to load matches");
      }
    })();
  }, [party_id, roundId]);

  // Realtime navigation back to swipe
  useEffect(() => {
    if (!party_id) return;

    const ch = supabase
      .channel(`party-results-nav:${party_id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "parties",
          filter: `id=eq.${party_id}`,
        },
        (payload: any) => {
          const rec = payload.record ?? payload.new ?? payload.after ?? null;
          const newState = rec?.session_state ?? null;

          setParty(prev => ({
            session_state: newState,
            results_started_at: rec?.results_started_at ?? prev?.results_started_at ?? null,
            current_round_num: rec?.current_round_num ?? prev?.current_round_num ?? null,
          }));

          if (newState === "in_progress") {
            router.push(`/party/swipe?party=${party_id}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [party_id, router]);

  const advanceNextRound = async () => {
    if (!party_id || !roundId) return;
    if (advancing) return;

    setAdvancing(true);
    setError(null);

    try {
      const res = await fetch("/api/rounds/nextRound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ party_id, round_id: roundId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Failed to advance round");
      }
      // do NOT router.push here — realtime subscription will handle navigation
    } catch (e: any) {
      setError(e.message ?? "Failed to advance round");
    } finally {
      setAdvancing(false);
    }
  };

  useEffect(() => {
    if (party?.session_state !== "results") return;
    if (secondsLeft === 0) advanceNextRound();
  }, [secondsLeft, party?.session_state]);

  return (
    <div className="mt-6 space-y-6 px-4">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              Results
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-50 sm:text-3xl">Round wrap-up</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                The group matches are in. The next round will start automatically once the timer finishes.
              </p>
            </div>
          </div>

          <div className="min-w-[150px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Round
            </div>
            <div className="mt-1 text-3xl font-semibold text-slate-50">
              {party?.current_round_num ?? "—"}
            </div>
          </div>
        </div>

      {error && (
        <div className="mt-4 rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

        <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Auto-proceeding</div>
              <div className="text-xs text-slate-400">{secondsLeft}s</div>
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 via-amber-400 to-emerald-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <p className="mt-4 text-sm text-slate-300">
              {advancing ? "Starting the next round..." : "Get ready. Everyone will move back into swiping automatically."}
            </p>

            {isHost && (
              <button
                onClick={advanceNextRound}
                disabled={advancing || !roundId}
                className="mt-4 rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 transition hover:bg-pink-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {advancing ? "Advancing..." : "Start next round now"}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
            <div className="mb-4 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Matched this round</div>
              <div className="text-xs text-slate-400">{matches.length}</div>
            </div>

            {matches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-6 text-center text-sm text-slate-400">
                No group matches yet.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {matches.map((m) => (
                  <div
                    key={`${m.media_type}:${m.tmdb_id}`}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3"
                  >
                    <div className="h-20 w-14 overflow-hidden rounded-xl bg-slate-900">
                      {m.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w300${m.poster_path}`}
                          alt={m.title}
                          width={120}
                          height={180}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center px-2 text-center text-[10px] text-slate-400">
                          No poster
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100">{m.title}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                        {m.media_type}
                      </div>
                      <div className="mt-2 text-xs text-emerald-300">
                        {m.like_count} like{m.like_count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
