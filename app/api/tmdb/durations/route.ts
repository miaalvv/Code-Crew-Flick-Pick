import { NextResponse } from "next/server";

function tmdb (path: string, params: Record<string, string> = {}) {
    const url = new URL (`https://api.themoviedb.org/3${path}`);
    Object.entries (params).forEach (([k, v]) => url.searchParams.set (k, v));

    return fetch (url.toString (), {
        headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}`},
        cache: "no-store",
    });
}

export async function GET (request: Request) {
    try {
        const { searchParams } = new URL (request.url);

        const min = searchParams.get ("min") || "0";
        const max = searchParams.get ("max") || "500";

        const res = await tmdb ("/discover/movie", {
            language: "en-US",
            sort_by: "popularity.desc",
            "with_runtime.gte": min,
            "with_runtime.lte": max,
        });

        if (!res.ok) {
            return NextResponse.json (
                { ok: false, status: res.status },
                { status: 500 }
            );
        }

        const data = await res.json ();
        const movies = data.results ?? [];

        return NextResponse.json ({
            ok: true,
            min: Number (min),
            max: Number (max),
            results: movies,
        });
    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e) },
            { status: 500 }
        )
    }
}