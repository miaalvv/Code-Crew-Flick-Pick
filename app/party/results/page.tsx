"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type Match = {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  like_count: number;
};

export default function PartyResults() {
  const params = useSearchParams();
  const party_id = params.get("party") ?? "";

  const [matches, setMatches] = useState<Match[]>([]);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!party_id) return;
    (async () => {
      setError(null);
      try {
        const res = await fetch("/api/swipes/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ party_id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Failed to load matches");
        setMatches(data.matches ?? []);
      } catch (e: any) {
        setError(e.message ?? "Failed to load matches");
      }
    })();
  }, [party_id]);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Party Results</h1>
      {error && <div className="border border-red-300 text-red-700 rounded p-2">{error}</div>}
      {matches.length === 0 ? (
        <p>No matches yet 🎬</p>
      ) : (
        <ul className="list-disc list-inside space-y-1">
          {matches.map((m) => (
            <li key={`${m.media_type}:${m.tmdb_id}`}>
              {m.title} ({m.media_type})
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
