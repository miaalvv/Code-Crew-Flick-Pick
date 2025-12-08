import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, "../../.env.local"),
});

import { getSupabase } from "../supabaseService.ts";

/*
    Test Script that tests completing a round where the session is done.
    Run with `npx ts-node scripts/completeRoundTests/testCompleteRound_sessionDone.ts`
*/

const BASE_URL = "http://localhost:3000";

async function main() {
    console.log("\n Creating Test Data . \n");

    const supabase = getSupabase();

    // create party
    const { data: party } = await supabase
        .from("parties")
        .insert({
        owner_id: "edde38d6-b4bc-41b8-83cd-cfa90bee289a",
        name: "Session Finished Test Party",
        })
        .select()
        .single();

    const party_id = party.id;

    // create party members
    const members = [
        { party_id, user_id: "edde38d6-b4bc-41b8-83cd-cfa90bee289a", role: "host" },
        { party_id, user_id: "5490a24e-16a1-4731-b625-3b65ef91ea86", role: "member" },
        { party_id, user_id: "622ce84a-52d5-45b3-9da5-aec35b165bbb", role: "member" },
    ];

    const { } = await supabase
        .from("party_members")
        .insert(members);

    // initialize round 1
    const { data: round } = await supabase
        .from("rounds")
        .insert({
            party_id,
            round_num: 1,
            is_active: true
        })
        .select()
        .single();

    const round_id = round.round_id;
  
    // create/insert candidate movies
     const movies = [
        {
        party_id,
        round_id,
        tmdb_id: 12,
        media_type: "movie",
        title: "Finding Nemo",
        poster_path: "/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
        is_match: false
        }
    ];

    const { } = await supabase
        .from("party_candidates")
        .insert(movies);

    // insert swipes for 3 users, all liking all 1 movies
    const users = ["edde38d6-b4bc-41b8-83cd-cfa90bee289a", 
        "5490a24e-16a1-4731-b625-3b65ef91ea86", 
        "622ce84a-52d5-45b3-9da5-aec35b165bbb"];
    const swipe = [];

    for (const user of users) {
        for (const movie of movies) {
        swipe.push({
            party_id,
            user_id: user,
            tmdb_id: movie.tmdb_id,
            media_type: movie.media_type,
            title: movie.title,
            poster_path: movie.poster_path,
            decision: "like",
            round_id
            });
        }
    }

    const { } = await supabase
        .from("swipes")
        .insert(swipe);

    // Now test the completeRound API

    const url = `${BASE_URL}/api/rounds/completeRound?party_id=${party_id}&round_id=${round_id}`;
    console.log("Calling:", url);

    const response = await fetch(url);
    const result = await response.json();

    console.log("API Response:", result);

    if (result.isSessionFinished && result.winner) {
        console.log("Session completed and winner returned.");
    } else {
        console.log("Error: Session not detected as complete.");
    }
}

main();
