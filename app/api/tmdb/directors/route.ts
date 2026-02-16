import { NextResponse } from "next/server";
import { supabase } from "@/app/_lib/supabaseClient"

type Director = {
    id: number;
    name: string;
    popularity: number;
    job: string;
};

type TMDBCrewResponse = {
    crew: Director [];
};

// used movie ids
// 533533, 9702, 238, 155, 680, 408, 756, 19995, 9799, 9615, 584, 64328
// const movieIds = [37799, 840464, 1084242, 83533]; 

// add more movie ids to have more directors
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

        // tries loading directors from database
        const { data: existing, error } = await supabase
            .from ("tmdb_directors")
            .select ("id, name");

        if (error) {
            return NextResponse.json ({ ok: false, error: error.message }, { status: 500})
        }    

        const existingMap = new Map (
            (existing ?? []).map (d => [d.id, d])
        )


        // Fetching new directors from tmdb
        const allDirectors: Director [] = [];

        for (const movieId of movieIds) {
            const res = await tmdb (`/movie/${movieId}/credits`);
            
            if (!res.ok) continue;
            
            const json: TMDBCrewResponse = await res.json ();

            // keeps crew members with the job title of "Director"
            const pullDirectors = (json.crew ?? []).filter (person => person.job === "Director");

            allDirectors.push (...pullDirectors);
        }

        // removes duplicate directors 
        const uniqueDirectors = Array.from (
            new Map (allDirectors.map (d => [d.id, d])).values ()
        );

        // inserts new unique directors into database    
        if (uniqueDirectors.length > 0) {

            const { data, error: upsertError } = await supabase
                .from ("tmdb_directors")
                .upsert (uniqueDirectors.map ((d) => ({
                    id: d.id,
                    name: d.name,
                    popularity: d.popularity,
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
        uniqueDirectors.forEach (d => merged.set (d.id, d));

        // combines new and existing directors, into one in order to return all items in tmdb_directors table into frontend keywords pref page 
        const { data: allFromDb, error: finalFetchError } = await supabase
            .from ("tmdb_directors")
            .select ("id, name, popularity");

        if (finalFetchError) throw finalFetchError;

        return NextResponse.json ({
            ok: true,
            directors: allFromDb,
            source: "tmdb",
        });

    } catch (e) {
        return NextResponse.json (
            { ok: false, error: String (e)},
            { status: 500}
        );
    }
}