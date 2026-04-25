// app/party/new/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createParty } from "@/app/_lib/partyApi";

export default function CreatePartyPage() {
  const [name, setName] = useState("");
  const [invite, setInvite] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true);
    setError(null);
    setInvite(null);
    setPartyId(null);
    try {
      const res = await createParty({
        name,
        movieCount: 10,
      });
      setInvite(res.invite_code);
      setPartyId(res.party_id);
    } catch (e: any) {
      setError(e.message ?? "Failed to create party");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-6 px-4">
      <section className="rounded-3xl border border-slate-700/70 bg-slate-900/80 p-6 shadow-xl shadow-black/40 space-y-3 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/40 bg-pink-500/10 px-3 py-1 text-[11px] font-medium text-pink-200">
          <span className="h-2 w-2 rounded-full bg-pink-400" />
          Party
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-50">Create a watch party</h1>
        <p className="text-sm text-slate-300 max-w-2xl">
          Name your party, generate an invite code, and share it so everyone can join and start swiping together.
        </p>

        {error && (
          <div className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </div>
        )}

        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1">
            <label className="text-[11px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
              Party name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30"
              placeholder="e.g. Friday Flicks"
            />
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="inline-flex items-center justify-center rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-pink-500/40 ring-1 ring-pink-300/60 hover:bg-pink-400 hover:shadow-pink-400/40 disabled:opacity-50 disabled:cursor-not-allowed transition self-start sm:self-auto"
          >
            {loading ? "Creating…" : "Create party"}
          </button>
        </div>

        {invite && partyId && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-black/30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.08em] text-slate-400 font-semibold">Invite code</div>
                <div className="text-lg font-semibold text-slate-50">{invite}</div>
              </div>
              <div className="inline-flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(invite)}
                  className="rounded-full border border-slate-600/70 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-100 hover:border-pink-400 hover:bg-slate-700/80 transition"
                >
                  Copy
                </button>
                <button
                  onClick={() => router.push(`/party/lobby?party=${partyId}`)}
                  className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-emerald-500/30 hover:bg-emerald-400 transition"
                >
                  Go to lobby
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-300">
              Share the code with friends so they can join this party. You can always find it later in the lobby.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
