'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../_lib/supabaseClient';

export default function Header() {
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [partyMenuOpen, setPartyMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const loadProfile = async (userId: string | undefined) => {
      if (!userId) {
        setDisplayName(null);
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error(error);
        setDisplayName(null);
        return;
      }

      const name = profile?.display_name?.trim();
      setDisplayName(name || null);
    };

    supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      setEmail(data.user?.email ?? null);
      loadProfile(userId);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const userId = session?.user?.id;
      setEmail(session?.user?.email ?? null);
      loadProfile(userId);
    });

    return () => {
      sub?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!menuOpen) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const handleClickParty = (e: MouseEvent) => {
      if (!partyMenuOpen) return;
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      if ((e.target as Node) instanceof Element && (e.target as Element).closest('#party-menu')) return;
      setPartyMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickParty);
    return () => document.removeEventListener('mousedown', handleClickParty);
  }, [partyMenuOpen]);

  const signOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  const avatarLabel = (displayName || email || '?').trim();
  const avatarLetter = avatarLabel[0]?.toUpperCase() ?? '?';

  return (
   <header className="flex items-center justify-between gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/70 px-4 py-3 shadow-lg shadow-black/30 backdrop-blur-md">
      {menuOpen && <div className="fixed inset-0 z-40" aria-hidden="true" />}
      {/* Logo / brand */}
      <Link href="/" className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/90 text-sm font-semibold shadow-md">
          FP
        </div>
        <div className="leading-tight">
          <div className="font-semibold tracking-tight text-lg sm:text-xl">
            FlickPick
          </div>
        </div>
      </Link>

   {/* Nav + auth */}
      <nav className="flex items-center gap-3 text-sm">
        {email ? (
          <div className="relative flex items-center" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-50 hover:border-pink-400 hover:bg-slate-700/80 transition"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-amber-400 text-sm font-semibold text-white shadow-md shadow-pink-500/30">
                {avatarLetter}
              </span>
              <span className="truncate max-w-[140px]">{displayName || email}</span>
              <svg
                aria-hidden="true"
                className="h-3.5 w-3.5 text-slate-200"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/10 bg-slate-950 shadow-xl shadow-black/40 text-sm overflow-hidden z-50"
                  role="menu"
                  style={{ zIndex: 60 }}
                >
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="text-xs text-slate-400">Signed in as</div>
                  <div className="font-semibold text-slate-100 truncate">{displayName || email}</div>
                </div>
                <Link
                  href="/profile"
                  className="block px-4 py-2.5 text-slate-100 hover:bg-white/5"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                >
                  Personalize profile
                </Link>
                <button
                  onClick={signOut}
                  className="block w-full text-left px-4 py-2.5 text-red-200 hover:bg-red-500/10"
                  role="menuitem"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-pink-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md hover:bg-pink-400 transition"
          >
            Sign in
          </Link>
        )}

        <div className="hidden sm:flex items-center gap-2 text-slate-100">
          <Link
            href="/"
            className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/70 hover:border-pink-400 hover:bg-slate-700/80 transition"
            aria-label="Home"
          >
            <svg aria-hidden="true" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5Z" />
            </svg>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-lg transition group-hover:opacity-100">
              Home
            </span>
          </Link>
          <Link
            href="/dashboard"
            className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/70 hover:border-pink-400 hover:bg-slate-700/80 transition"
            aria-label="Dashboard"
          >
            <svg aria-hidden="true" className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 13h6V3H3zM3 21h6v-6H3zM13 21h8V11h-8zM13 3v6h8V3z" />
            </svg>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-lg transition group-hover:opacity-100">
              Dashboard
            </span>
          </Link>
          <Link
            href="/friends"
            className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/70 bg-slate-800/70 hover:border-pink-400 hover:bg-slate-700/80 transition"
            aria-label="Friends"
          >
            <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z" />
              <path d="M4 20v-1.5C4 16.57 6.69 15 10 15s6 1.57 6 3.5V20" />
              <path d="M17.5 11.5c1.38 0 2.5-1.12 2.5-2.5S18.88 6.5 17.5 6.5 15 7.62 15 9s1.12 2.5 2.5 2.5Z" />
              <path d="M21 20v-1c0-1.6-1.4-2.9-3.5-3.4" />
            </svg>
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-100 opacity-0 shadow-lg transition group-hover:opacity-100">
              Friends
            </span>
          </Link>
          <div className="relative" id="party-menu">
            <button
              onClick={() => setPartyMenuOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-pink-500/70 bg-slate-900/90 px-3.5 text-xs font-semibold text-slate-100 hover:border-pink-400 hover:bg-slate-800/90 transition"
              aria-haspopup="menu"
              aria-expanded={partyMenuOpen}
              title="Create a new party"
            >
              <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <svg aria-hidden="true" className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {partyMenuOpen && (
              <div className="absolute right-0 translate-x-2 mt-1 w-40 rounded-xl border border-white/10 bg-slate-950 shadow-xl shadow-black/40 text-sm overflow-hidden z-50">
                <Link
                  href="/party/new"
                  className="block px-3 py-2.5 text-slate-100 hover:bg-white/5"
                  onClick={() => setPartyMenuOpen(false)}
                >
                  Host a party
                </Link>
                <Link
                  href="/party/join"
                  className="block px-3 py-2.5 text-slate-100 hover:bg-white/5"
                  onClick={() => setPartyMenuOpen(false)}
                >
                  Join a party
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}
