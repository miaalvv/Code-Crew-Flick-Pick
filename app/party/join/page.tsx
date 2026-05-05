// app/party/join/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { joinParty } from "@/app/_lib/partyApi";

export default function JoinPartyPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleJoin() {
    setLoading(true); setError(null);
    try {
      const { party_id } = await joinParty(code.trim());
      router.push(`/party/lobby?party=${party_id}`);
    } catch (e: any) {
      setError(e.message ?? "Failed to join");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6 px-4">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-4">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
            <span className="h-2 w-2 rounded-full bg-pink-400" />
            Party
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">Join a watch party</h1>
          <p className="max-w-2xl text-sm text-slate-300">
            Enter the invite code from your host to jump straight into the lobby and get ready to swipe with the group.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner shadow-black/20">
          <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Invite code
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm tracking-[0.18em] text-slate-100 uppercase outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30"
              placeholder="ABC123"
              maxLength={12}
            />
            <button
              onClick={handleJoin}
              disabled={loading || !code.trim()}
              className="inline-flex items-center justify-center rounded-full bg-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/40 ring-1 ring-pink-300/60 transition hover:bg-pink-400 hover:shadow-pink-400/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join"}
            </button>
          </div>

          <p className="mt-3 text-[11px] text-slate-400">
            Ask your host for the code if you do not have it yet.
          </p>
        </div>
      </section>
    </div>
  );
}
