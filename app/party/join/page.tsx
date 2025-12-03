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
      router.push(`/party/swipe?party=${party_id}`);
    } catch (e:any) {
      setError(e.message ?? "Failed to join");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Join Party</h1>
      {error && <div className="border border-red-300 text-red-700 rounded p-2">{error}</div>}
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e)=>setCode(e.target.value)}
          className="w-full rounded border bg-black px-3 py-2"
          placeholder="INVITE CODE"
        />
        <button onClick={handleJoin} disabled={loading || !code.trim()} className="rounded border px-4 py-2">
          {loading ? "Joining..." : "Join"}
        </button>
      </div>
    </div>
  );
}
