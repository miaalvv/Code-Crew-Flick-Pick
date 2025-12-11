import { NextResponse } from "next/server";

type Genre = {
    id: number;
    name: string;
};

type TMDBGenreResponse = {
    genres: Genre [];
};

function tmdb (path: string, params: Record<string, string> = {}) {
    const url = new URL (`https://api.themoviedb.org/3${path}`);
    Object.entries (params).forEach (([k, v]) => url.searchParams.set (k, v));

    return fetch (url.toString (), {
        headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}`},
        cache: "no-store",
    });
}

export async function GET () {
    try {
        const res = await tmdb ("/genre/movie/list", {  
            language: "en-US",
        });

        if (!res.ok) {
            return NextResponse.json (
                { ok: false, status: res.status },
                { status: 500 }
            );
        }

        const data: TMDBGenreResponse = await res.json ();
        const genres = data.genres ?? [];

        return NextResponse.json ({
            ok: true,
            genres, 
        });
    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e) },
            { status: 500 }
        );
    }
}