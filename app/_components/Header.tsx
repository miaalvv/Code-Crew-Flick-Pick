'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';
import Link from 'next/link';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // initial state
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    // live updates (login/logout in other tabs etc.)
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
  <header className="flex items-center justify-between p-4 border-b">
    <Link href="/" className="font-semibold">FlickPick</Link>

    {email ? (
      <div className="flex items-center gap-4">
        {/* show user email */}
        <span className="text-sm opacity-80">{email}</span>

        {/* quick dashboard link */}
        <Link href="/dashboard" className="underline">
          Dashboard
        </Link>

        {/* sign out button */}
        <button
          onClick={signOut}
          className="rounded border px-3 py-1"
        >
          Sign out
        </button>
      </div>
    ) : (
      <Link className="underline" href="/login">Sign in</Link>
    )}
  </header>
);

}
