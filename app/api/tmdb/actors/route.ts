import { NextResponse } from "next/server";
import { supabase } from "@/app/_lib/supabaseClient"

type Actor = {
    id: number;
    name: string;
    popularity: number;
};

type TMDBCastResponse = {
    cast: Actor [];
};

// used movie ids
// 533533, 9702, 238, 155, 680, 408, 756, 19995, 9799, 9615, 584, 64328
// const movieIds = [37799, 840464, 1084242, 83533]; 

// add more movie ids to have more actors
const movieIds = [83533];

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

        // tries loading actors from database
        const { data: existing, error } = await supabase
            .from ("tmdb_actors")
            .select ("id, name");

        if (error) {
            return NextResponse.json ({ ok: false, error: error.message }, { status: 500})
        }    

        const existingMap = new Map (
            (existing ?? []).map (a => [a.id, a])
        )

        

        // Fetching new actors from tmdb
        const allActors: Actor [] = [];

        for (const movieId of movieIds) {
            const res = await tmdb (`/movie/${movieId}/credits`);
            
            if (!res.ok) continue;
            
            const json: TMDBCastResponse = await res.json ();
            allActors.push (...(json.cast ?? []));
        }

        // removes duplicate actors 
        const uniqueActors = Array.from (
            new Map (allActors.map (a => [a.id, a])).values ()
        );

        // inserts new unique actors into database    
        if (uniqueActors.length > 0) {

            const { data, error: upsertError } = await supabase
                .from ("tmdb_actors")
                .upsert (uniqueActors.map ((a) => ({
                    id: a.id,
                    name: a.name,
                    popularity: a.popularity,
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
        uniqueActors.forEach (a => merged.set (a.id, a));

        // combines new and existing actors, into one in order to return all items in tmdb_actors table into frontend keywords pref page 
        const { data: allFromDb, error: finalFetchError } = await supabase
            .from ("tmdb_actors")
            .select ("id, name, popularity");

        if (finalFetchError) throw finalFetchError;

        return NextResponse.json ({
            ok: true,
            actors: allFromDb,
            source: "tmdb",
        });

    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e)},
            { status: 500}
        );
    }
}