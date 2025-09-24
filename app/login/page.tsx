'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../_lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // If already logged in, bounce to dashboard
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) window.location.href = '/dashboard';
    });
  }, []);

  const sendLink = async () => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin } // comes back to your site
    });
    if (error) alert(error.message);
    else setSent(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        {sent ? (
          <p>Check your inbox for the magic link.</p>
        ) : (
          <>
            <input
              className="w-full border rounded p-2"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button onClick={sendLink} className="w-full rounded bg-black text-white p-2">
              Send magic link
            </button>
          </>
        )}
      </div>
    </main>
  );
}
