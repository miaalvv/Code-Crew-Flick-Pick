import { NextResponse } from "next/server";
import { supabase } from "@/app/_lib/supabaseClient"

type Keyword = {
    id: number;
    name: string;
};

type TMDBKeywordResponse = {
    id: number;
    keywords: Keyword [];
};

// used movie ids
// 533533, 9702, 238, 155, 680, 408, 756, 19995, 9799, 9615, 584, 64328
// const movieIds = [37799, 840464, 1084242, 83533]; 

// add more movie ids to have more keywords
const movieIds = [37799];

function tmdb (path: string) {
    const url = new URL (`https://api.themoviedb.org/3${path}`);
    url.searchParams.set ("language", "en-US")

    return fetch (url.toString (), {
        headers: { Authorization: `Bearer ${process.env.TMDB_API_KEY}`},
        cache: "no-store",
    });
}

export async function GET () {
    try {

        // tries loading keywords from database
        const { data: existing, error } = await supabase
            .from ("tmdb_keywords")
            .select ("id, name");

        if (error) {
            return NextResponse.json ({ ok: false, error: error.message }, { status: 500})
        }    

        const existingMap = new Map (
            (existing ?? []).map (k => [k.id, k])
        )

        

        // Fetching new keywords from tmdb
        const allKeywords: Keyword [] = [];

        for (const movieId of movieIds) {
            const res = await tmdb (`/movie/${movieId}/keywords`);
            
            if (!res.ok) continue;
            
            const json: TMDBKeywordResponse = await res.json ();
            allKeywords.push (...(json.keywords ?? []));
        }

        // removes duplicate keywords 
        const uniqueKeywords = Array.from (
            new Map (allKeywords.map (k => [k.id, k])).values ()
        );

        // inserts new unique keywords into database    
        if (uniqueKeywords.length > 0) {

            const { data, error: upsertError } = await supabase
                .from ("tmdb_keywords")
                .upsert (uniqueKeywords, {onConflict: "id"})
                .select ();
            
            console.log ("UPSERT RESULT: ", { data, upsertError});

            if (upsertError) {
                return NextResponse.json (
                    { ok: false, error: upsertError.message},
                    {status: 500}
                );
            }
        }


        const merged = new Map (existingMap);
        uniqueKeywords.forEach (k => merged.set (k.id, k));

        // combines new and existing keywords, into one in order to return all items in tmdb_keywords table into frontend keywords pref page 
        const { data: allFromDb, error: finalFetchError } = await supabase
            .from ("tmdb_keywords")
            .select ("id, name");

        if (finalFetchError) throw finalFetchError;

        return NextResponse.json ({
            ok: true,
            keywords: allFromDb,
            source: "tmdb",
        });

    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e)},
            { status: 500}
        );
    }
}