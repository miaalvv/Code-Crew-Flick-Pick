"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createParty } from "@/app/_lib/partyApi";

export default function CreatePartyPage() {
  const [name, setName] = useState("Movie Night");
  const [invite, setInvite] = useState<string | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleCreate() {
    setLoading(true); setError(null);
    try {
      const res = await createParty({
        name,
        movieCount: 10,
      });
      setInvite(res.invite_code);
      setPartyId(res.party_id);
    } catch (e:any) {
      setError(e.message ?? "Failed to create party");
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Create Party</h1>

      {error && <div className="border border-red-300 text-red-700 rounded p-2">{error}</div>}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e)=>setName(e.target.value)}
          className="w-full rounded border bg-black px-3 py-2"
          placeholder="Party name"
        />
        <button onClick={handleCreate} disabled={loading} className="rounded border px-4 py-2">
          {loading ? "Creating..." : "Create"}
        </button>
      </div>

      {invite && partyId && (
        <div className="mt-4 space-y-2 rounded border p-3">
          <div className="text-sm text-gray-400">Invite code</div>
          <code className="rounded bg-black/40 px-2 py-1">{invite}</code>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(invite)}
              className="rounded border px-3 py-1 text-sm"
            >
              Copy
            </button>
            <button
              onClick={() => router.push(`/party/swipe?party=${partyId}`)}
              className="rounded border px-3 py-1 text-sm"
            >
              Go to Swipe
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
