'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../../_lib/supabaseClient';

type Card = {
  id: number;
  title: string;
  poster_path?: string | null;
  overview?: string;
  media_type: 'movie' | 'tv';
};

export default function PartyPage({ params }: { params: { id: string }}) {
  const partyId = params.id;
  const [userId, setUserId] = useState<string | null>(null);
  const [invite, setInvite] = useState<string>('');
  const [cards, setCards] = useState<Card[]>([]);
  const pageRef = useRef(1);

  // load my providers to filter discover
  const [providerIds, setProviderIds] = useState<number[]>([]);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      setUserId(user.id);

      // make sure I'm a member
      await supabase.from('party_members').upsert({ party_id: partyId, user_id: user.id });

      // fetch invite code for sharing
      const { data: party } = await supabase.from('parties').select('invite_code').eq('id', partyId).single();
      setInvite(party?.invite_code ?? '');

      // load my services
      const { data: rows } = await supabase.from('user_services').select('provider_id').eq('user_id', user.id);
      setProviderIds((rows ?? []).map(r => r.provider_id));

      loadMore((rows ?? []).map(r => r.provider_id));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partyId]);

  const loadMore = async (provIds = providerIds) => {
    const res = await fetch('/api/tmdb/discover', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider_ids: provIds, page: pageRef.current })
    });
    const json = await res.json();
    if (json.ok) {
      setCards(prev => [...prev, ...json.results]);
      pageRef.current += 1;
    }
  };

  const swipe = async (c: Card, decision: 'like' | 'skip') => {
    setCards(prev => prev.filter(x => x.id !== c.id)); // optimistic remove
    await fetch('/api/swipes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        party_id: partyId,
        tmdb_id: c.id,
        media_type: c.media_type,
        title: c.title,
        poster_path: c.poster_path,
        decision
      })
    });
    // top-up if low
    if (cards.length < 5) loadMore();
  };

  const share = useMemo(() =>
    invite ? `${typeof window !== 'undefined' ? window.location.origin : ''}/party/join?code=${invite}` : '', [invite]);

  return (
    <main className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Party</h1>
        {invite && <span className="text-sm opacity-80">Invite code: <b>{invite}</b></span>}
      </div>

      {share && (
        <div className="text-sm">
          Share this link: <span className="underline">{share}</span>
        </div>
      )}

      {cards.length === 0 ? (
        <div className="py-12 opacity-80">Loading movies…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {cards.slice(0, 20).map(c => (
            <div key={c.id} className="border rounded overflow-hidden">
              {c.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w342${c.poster_path}`}
                  alt={c.title}
                  width={342} height={513}
                />
              ) : <div className="w-[342px] h-[513px] bg-white/10" />}
              <div className="p-2 text-sm font-medium truncate">{c.title}</div>
              <div className="flex gap-2 p-2">
                <button onClick={() => swipe(c, 'skip')} className="flex-1 border rounded px-2 py-1">Skip</button>
                <button onClick={() => swipe(c, 'like')} className="flex-1 border rounded px-2 py-1">Like</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
