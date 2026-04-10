// app/party/lobby/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { supabase as globalSupabase } from "@/app/_lib/supabaseClient";

const supabase =
  globalSupabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

type LobbyRow = {
  user_id: string;
  joined_at: string;
  is_ready: boolean;
  display_name: string | null;
  role?: string | null;
};

export default function LobbyPage() {
  const params = useSearchParams();
  const router = useRouter();
  const party_id = params.get("party") ?? "";

  const [members, setMembers] = useState<LobbyRow[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [sessionState, setSessionState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function getAccessToken(): Promise<string> {
    const sessionRes = await supabase.auth.getSession();
    return sessionRes.data.session?.access_token ?? "";
  }

  async function fetchMemberRoles(): Promise<Record<string, string>> {
    const { data } = await supabase
      .from("party_members")
      .select("user_id, role")
      .eq("party_id", party_id);

    return (data ?? []).reduce((acc: Record<string, string>, r: any) => {
      acc[r.user_id] = r.role ?? "";
      return acc;
    }, {});
  }

  async function fetchMembers() {
    if (!party_id) return;

    const { data: rows, error } = await supabase
      .from("party_lobby")
      .select(
        `
        user_id,
        joined_at,
        is_ready,
        profiles!party_lobby_user_fkey (
          display_name
        )
      `
      )
      .eq("party_id", party_id);

    if (error) {
      console.error("fetchMembers error:", error);
      return;
    }

    const rolesById = await fetchMemberRoles();

    const formatted: LobbyRow[] = (rows ?? []).map((r: any) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
      return {
        user_id: r.user_id,
        joined_at: r.joined_at,
        is_ready: Boolean(r.is_ready),
        display_name: profile?.display_name ?? `user_${r.user_id.slice(0, 8)}`,
        role: rolesById[r.user_id] ?? null,
      };
    });

    setMembers(formatted);
  }

  async function fetchPartyStateAndNavigate() {
    if (!party_id) return;

    const { data, error } = await supabase
      .from("parties")
      .select("session_state")
      .eq("id", party_id)
      .maybeSingle();

    if (error) {
      console.error("fetchPartyState error:", error);
      return;
    }

    const state = data?.session_state ?? null;
    setSessionState(state);

    if (state === "in_progress") {
      router.push(`/party/swipe?party=${party_id}`);
    }
  }

  async function checkIsHost() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    setCurrentUserId(data.user.id);

    const { data: pm } = await supabase
      .from("party_members")
      .select("role")
      .eq("party_id", party_id)
      .eq("user_id", data.user.id)
      .maybeSingle();

    setIsHost(pm?.role === "host");
  }

  async function toggleReady() {
    if (!party_id || !currentUserId) return;

    const myReady =
      members.find((m) => m.user_id === currentUserId)?.is_ready ?? false;

    const newReady = !myReady;

    // optimistic UI
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === currentUserId ? { ...m, is_ready: newReady } : m
      )
    );

    try {
      const token = await getAccessToken();

      const res = await fetch("/api/party/lobby/toggleReady", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ party_id, ready: newReady }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to toggle ready");
      }
    } catch (err) {
      console.error("toggleReady error:", err);
      await fetchMembers(); // revert
    }
  }

  // Join lobby once on mount for this party
  useEffect(() => {
    if (!party_id) return;

    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        await fetch("/api/party/lobby/join", {
          method: "POST",
          body: JSON.stringify({ party_id }),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (e) {
        console.error("join lobby error:", e);
        if (!cancelled) setError("Failed to join lobby.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [party_id]);

  // Initial load + realtime members list
  useEffect(() => {
    if (!party_id) return;

    let lobbyChannel: any;
    let cancelled = false;

    (async () => {
      await fetchMembers();
      await fetchPartyStateAndNavigate();
      await checkIsHost();

      if (cancelled) return;

      lobbyChannel = supabase
        .channel(`lobby:${party_id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "party_lobby",
            filter: `party_id=eq.${party_id}`,
          },
          async () => {
            await fetchMembers();
          }
        )
        .subscribe();

      // extra fetch after subscribe to avoid missed events
      await fetchMembers();
    })();

    return () => {
      cancelled = true;
      if (lobbyChannel) supabase.removeChannel(lobbyChannel);
    };
  }, [party_id]);

  // Realtime: party state changes (move everyone to swipe when host starts)
  useEffect(() => {
    if (!party_id) return;

    const ch = supabase
      .channel(`party-state:${party_id}`)
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

          setSessionState(newState);

          if (newState === "in_progress") {
            router.push(`/party/swipe?party=${party_id}`);
          }
        }
      )
      .subscribe();

    // one immediate fetch in case we missed the update before subscribing
    fetchPartyStateAndNavigate().catch(() => {});

    return () => {
      supabase.removeChannel(ch);
    };
  }, [party_id, router]);

  const readyCount = members.filter((m) => m.is_ready).length;

  async function handleStart() {
    if (!party_id) return;

    setLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();

      const res = await fetch("/api/party/startSession", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ party_id, movieCount: 10 }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to start session");

      // host can navigate immediately
      router.push(`/party/swipe?party=${party_id}`);
    } catch (e: any) {
      console.error("startSession error:", e);
      setError(e?.message ?? "Failed to start session");
    } finally {
      setLoading(false);
    }
  }

  const meReady =
    members.find((m) => m.user_id === currentUserId)?.is_ready ?? false;

  return (
    <div className="mt-6 space-y-6 px-4">
      <section className="max-w-5xl mx-auto rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
              <span className="h-2 w-2 rounded-full bg-pink-400" />
              Lobby
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">Waiting on your crew</h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              Share this party link so friends can join. When everyone is ready, the host can start swiping together.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-200">
            <div className="text-[11px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
              Party ID
            </div>
            <div className="text-lg font-semibold text-slate-50 truncate max-w-[180px]">{party_id || "—"}</div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">
                Members <span className="text-slate-400">({readyCount}/{members.length} ready)</span>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {members.length === 0 && (
                <p className="text-xs text-slate-400">No one here yet. Share your link to invite friends.</p>
              )}
              {members.map((m) => (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                    {(m.display_name || "?")[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm text-slate-100 truncate">
                      <span className="truncate">{m.display_name}</span>
                      {m.role === "host" && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/60 bg-amber-300/10 px-2 py-0.5 text-[10px] font-semibold text-amber-100">
                          Host
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      {m.user_id === currentUserId && <span>(you)</span>}
                    </div>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      m.is_ready ? "text-emerald-300" : "text-slate-500"
                    }`}
                  >
                    {m.is_ready ? "Ready" : "Not ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-100">Status</div>
              <span className="text-[11px] text-slate-400">
                {sessionState === "in_progress" ? "Swiping" : "Waiting"}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-200">
              <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-pink-500 transition-all"
                  style={{
                    width: members.length ? `${(readyCount / Math.max(members.length, 1)) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-slate-400 w-12 text-right">
                {readyCount}/{members.length || 1}
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={toggleReady}
                className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
                  meReady
                    ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400"
                    : "bg-slate-800 text-slate-100 border border-slate-600 hover:border-pink-400"
                }`}
              >
                {meReady ? "Set as not ready" : "I'm ready"}
              </button>

              {isHost && (
                <button
                  onClick={handleStart}
                  disabled={loading || sessionState === "in_progress" || members.length === 0 || readyCount === 0}
                  className="w-full rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-pink-500/30 hover:bg-pink-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Starting…" : "Start swiping"}
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400">
              Everyone should mark ready. The host can start once people are ready.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
