import './globals.css';
import Header from './_components/Header';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'FlickPick',
  description: 'Movie swiping app',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
        <div className="min-h-screen max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6">
          <Header />
          <main className="flex-1 pb-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
