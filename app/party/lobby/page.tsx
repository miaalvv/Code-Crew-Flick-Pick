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

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Lobby</h1>
      <p className="text-sm text-gray-500">
        Waiting for teammates to join. Host starts the session.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-400 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4">
        <div className="font-semibold">
          Members ({readyCount}/{members.length} ready)
        </div>

        <ul className="mt-2">
          {members.map((m) => (
            <li key={m.user_id} className="py-1 flex items-center gap-2">
              <span className="font-medium">{m.display_name}</span>

              {m.role === "host" && (
                <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-white">
                  Host
                </span>
              )}

              {m.user_id === currentUserId && (
                <span className="text-xs text-gray-400">(you)</span>
              )}

              <span className="ml-auto text-sm text-green-400">
                {m.is_ready ? "Ready" : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-x-2">
        <button
          onClick={toggleReady}
          className="rounded border border-gray-700 px-4 py-2 text-white"
        >
          {members.find((m) => m.user_id === currentUserId)?.is_ready
            ? "Unready"
            : "I'm Ready"}
        </button>

        {isHost && (
          <button
            onClick={handleStart}
            disabled={loading || sessionState === "in_progress"}
            className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          >
            {loading ? "Starting…" : "Start Session"}
          </button>
        )}
      </div>
    </div>
  );
}