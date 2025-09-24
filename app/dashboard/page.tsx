'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      // 1) require auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }
      setEmail(user.email ?? null);

      // 2) ensure a profile row exists
      const { data: existing, error: selErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (selErr) {
        console.error('profiles select error', selErr);
      }

      if (!existing) {
        const displayName = user.email?.split('@')[0] ?? 'User';
        const { error: insErr } = await supabase.from('profiles').insert({
          id: user.id,
          display_name: displayName,
        });
        if (insErr) console.error('profiles insert error', insErr);
      }

      setLoading(false);
    })();
  }, []);

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p>Welcome{email ? `, ${email}` : ''}!</p>

      <div className="flex gap-3">
        <a href="/preferences" className="rounded border px-3 py-2">Pick Services</a>
        <a href="/party/new" className="rounded border px-3 py-2">Create Party</a>
        <a href="/party/join" className="rounded border px-3 py-2">Join Party</a>
      </div>
    </main>
  );
}
