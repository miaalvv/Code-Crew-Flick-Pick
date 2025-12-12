import { NextResponse } from "next/server";

type Keyword = {
    id: number;
    name: string;
};

type TMDBKeywordResponse = {
    id: number;
    keywords: Keyword [];
};

function tmdb (path: string, params: Record<string, string> = {}) {
    const url = new URL (`https://api.themoviedb.org/3${path}`);
    Object.entries (params).forEach (([k, v]) => url.searchParams.set (k, v));

    return fetch (url.toString (), {
        headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}`},
        cache: "no-store",
    });
}

export async function GET (req: Request) {
    try {
        const { searchParams } = new URL (req.url);
        const movieId = searchParams.get ("movieId");

        if (!movieId) {
            return NextResponse.json (
                { ok: false, error: "Missing movieId parameter" },
                {status: 400}
            );
        }

        const res = await tmdb (`/movie/${movieId}/keywords`);

        if (!res.ok) {
            return NextResponse.json (
                { ok: false},
                { status: 500}
            );
        }

        const data: TMDBKeywordResponse = await res.json ();
        const keywords = data.keywords ?? [];

        return NextResponse.json ({
            ok: true,
            keywords,
        });
    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e)},
            { status: 500}
        );
    }
}