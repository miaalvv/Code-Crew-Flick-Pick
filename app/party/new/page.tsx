'use client';
import { useState } from 'react';

export default function NewPartyPage() {
  const [name, setName] = useState('Movie Night');
  const create = async () => {
    const res = await fetch('/api/party', { method: 'POST', body: JSON.stringify({ action:'create', name }) });
    const json = await res.json();
    if (!json.ok) return alert('Error creating party');
    window.location.href = `/party/${json.party.id}`;
  };
  return (
    <main className="p-6 space-y-3">
      <h1 className="text-2xl font-semibold">Create Party</h1>
      <input value={name} onChange={e=>setName(e.target.value)} className="border rounded p-2 w-72" />
      <button onClick={create} className="rounded border px-4 py-2">Create</button>
    </main>
  );
}
