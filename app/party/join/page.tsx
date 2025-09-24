'use client';
import { useState } from 'react';

export default function JoinPartyPage() {
  const [code, setCode] = useState('');
  const join = async () => {
    const res = await fetch('/api/party', { method: 'POST', body: JSON.stringify({ action:'join', invite_code: code.trim().toUpperCase() }) });
    const json = await res.json();
    if (!json.ok) return alert('Invalid code');
    window.location.href = `/party/${json.party.id}`;
  };
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Join Party</h1>
      <input value={code} onChange={e=>setCode(e.target.value)} placeholder="Invite code" className="border rounded p-2 w-56 uppercase tracking-widest" />
      <button onClick={join} className="rounded border px-4 py-2">Join</button>
    </main>
  );
}
