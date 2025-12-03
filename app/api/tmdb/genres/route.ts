import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/*
    Does not work (supposed to fetch genres from api and store into table into supabase)
*/

//fetches the genre from the API
async function fetchGenres() {
    const res = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${process.env.TMDB_API_KEY}`);
    console.log("TMDB response status:", res.status);

    const genreData = await res.json();
    console.log("TMDB raw data:", genreData);

    return genreData.genres;
}

//maps table columns to genre json data and inserts into genres table
export async function GET() {
    const genres = await fetchGenres();
    const { error } = await supabaseAdmin
        .from("genres") // deleted genres tables (need to add if want to revive this file)
        .upsert(
            genres.map((g: { id: number; name: string }) => ({
                genre_id: g.id,
                name: g.name,
            })),
            { onConflict: "genre_id" }
        );
    if (error) {
        console.error("Error: Genres Insertion", error);
        return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}