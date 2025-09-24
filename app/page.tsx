'use client';
import { useEffect, useState } from 'react';

type TMDBItem = {
  id: number;
  title?: string;   // movies
  name?: string;    // tv shows
  poster_path?: string | null;
};

type PingResponse = {
  ok: boolean;
  sample?: TMDBItem;
};


export default function Home() {
  const [sample, setSample] = useState<PingResponse | null>(null);

  useEffect(() => {
    fetch('/api/tmdb/ping').then(r => r.json()).then(setSample).catch(console.error);
  }, []);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">FlickPick</h1>
      <a className="underline" href="/login">Sign in</a>

      {sample?.ok && (
        <p className="mt-4">TMDB api working OKAY. First popular title: <b>{sample.sample?.title ?? sample.sample?.name}</b></p>
      )}
    </main>
  );
}
