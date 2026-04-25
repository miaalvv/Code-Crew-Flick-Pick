import { NextResponse } from "next/server";
import { supabase } from "@/app/_lib/supabaseClient"

type Studio = {
    id: number;
    name: string;
    origin_country?: string;
};

type TMDBMovieResponse = {
    production_companies: Studio [];
};

// used movie ids
// 533533, 9702, 238, 155, 680, 408, 756, 19995, 9799, 9615, 584, 64328
// const movieIds = [37799, 840464, 1084242, 83533]; 

// add more movie ids to have more studios
const movieIds = [533533, 9702, 238, 155, 680, 408, 756, 19995, 9799, 9615, 584, 64328, 83533];

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

        // tries loading studios from database
        const { data: existing, error } = await supabase
            .from ("tmdb_studios")
            .select ("id, name");

        if (error) {
            return NextResponse.json ({ ok: false, error: error.message }, { status: 500})
        }    

        const existingMap = new Map (
            (existing ?? []).map (s => [s.id, s])
        )


        // Fetching new studios from tmdb
        const allStudios: Studio [] = [];

        for (const movieId of movieIds) {
            const res = await tmdb (`/movie/${movieId}`);
            
            if (!res.ok) continue;
            
            const json: TMDBMovieResponse = await res.json ();

            allStudios.push (...(json.production_companies ?? []));
        }

        // removes duplicate studios 
        const uniqueStudios = Array.from (
            new Map (allStudios.map (s => [s.id, s])).values ()
        );

        // inserts new unique studios into database    
        if (uniqueStudios.length > 0) {

            const { data, error: upsertError } = await supabase
                .from ("tmdb_studios")
                .upsert (uniqueStudios.map ((s) => ({
                    id: s.id,
                    name: s.name,
                })), 
                {onConflict: "id"})
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
        uniqueStudios.forEach (s => merged.set (s.id, s));

        // combines new and existing studios, into one in order to return all items in tmdb_studios table into frontend keywords pref page 
        const { data: allFromDb, error: finalFetchError } = await supabase
            .from ("tmdb_studios")
            .select ("id, name");

        if (finalFetchError) throw finalFetchError;

        return NextResponse.json ({
            ok: true,
            studios: allFromDb,
            source: "tmdb",
        });

    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e)},
            { status: 500}
        );
    }
}