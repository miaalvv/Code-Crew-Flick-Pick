'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../_lib/supabaseClient';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
   <header className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md">
      {/* Logo / brand */}
      <Link href="/" className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/90 text-sm font-semibold shadow-md">
          FP
        </div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight">FlickPick</div>
          <p className="hidden text-xs text-slate-400 sm:block">
            Swipe right to your next movie night
          </p>
        </div>
      </Link>

   {/* Nav + auth */}
      <nav className="flex items-center gap-4 text-sm">
        <Link
          href="/dashboard"
          className="hidden text-slate-300 hover:text-white sm:inline-block"
        >
          Dashboard
        </Link>

        {email ? (
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:inline">
              Signed in as <span className="font-medium text-slate-200"><Link href="/profile" className='hover:text-white'>{email}</Link></span>
            </span>
            <button
              onClick={signOut}
              className="rounded-full border border-slate-600/80 bg-slate-800/80 px-3 py-1 text-xs font-medium text-slate-50 hover:border-pink-500 hover:bg-slate-900 transition"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-pink-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-pink-400 transition"
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
