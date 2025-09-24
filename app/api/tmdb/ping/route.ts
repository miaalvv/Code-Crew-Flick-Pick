import { NextResponse } from "next/server";

export async function GET() {
  const url = new URL("https://api.themoviedb.org/3/movie/popular");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}` },
  });
  if (!res.ok) return NextResponse.json({ ok:false, status: res.status }, { status: 500 });

  const data = await res.json();
  return NextResponse.json({ ok:true, sample: data.results?.[0] });
}
