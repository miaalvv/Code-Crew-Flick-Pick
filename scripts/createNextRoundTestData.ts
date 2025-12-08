import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config({
    path: path.resolve(__dirname, "../.env.local"),
});

import { getSupabase } from "./supabaseService.ts";

/*
    Test Script that creates Test Data for Next Round testing.
    Run with `npx ts-node scripts/createNextRoundTestData.ts`
*/

async function main() {
    console.log("\n Creating Test Data for testNextRound.ts \n");

    const supabase = getSupabase();

    // Create test party
    const { data: party, error: partyErr } = await supabase
        .from("parties")
        .insert({
            owner_id: "edde38d6-b4bc-41b8-83cd-cfa90bee289a",
            name: "NextRound Test Party",
        })
        .select()
        .single();

    if (partyErr) {
        return console.error("Could not create party:", partyErr);
    }

    const party_id = party.id;
    console.log("Successfully created party:", party_id);

    // Insert 3 members
    const members = [
        { party_id, user_id: "edde38d6-b4bc-41b8-83cd-cfa90bee289a", role: "host" },
        { party_id, user_id: "5490a24e-16a1-4731-b625-3b65ef91ea86", role: "member" },
        { party_id, user_id: "622ce84a-52d5-45b3-9da5-aec35b165bbb", role: "member" },
    ];

    const { error: memberErr } = await supabase
        .from("party_members")
        .insert(members);

    if (memberErr) {
        return console.error("Could not insert party_members:", memberErr);
    }
    console.log("Successfully added party members");

    // Create round 1
    const { data: round, error: roundErr } = await supabase
        .from("rounds")
        .insert({
            party_id,
            round_num: 1,
            is_active: true
        })
        .select()
        .single();

    if (roundErr) {
        return console.error("Could not create round:", roundErr);
    }

    const old_round_id = round.round_id;
    console.log("Successfully created Round:", old_round_id);

    const movies = [
        {
            party_id,
            round_id: old_round_id,
            tmdb_id: 12,
            media_type: "movie",
            title: "Finding Nemo",
            poster_path: "/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
            is_match: true
        },
        {
            party_id,
            round_id: old_round_id,
            tmdb_id: 103,
            media_type: "movie",
            title: "Night at the Museum: Secret of the Tomb",
            poster_path: "/xwgy305K6qDs3D20xUO4OZu1HPY.jpg",
            is_match: true
        },
        {
            party_id,
            round_id: old_round_id,
            tmdb_id: 50619,
            media_type: "movie",
            title: "The Twilight Saga: Breaking Dawn - Part 1",
            poster_path: "/qs8LsHKYlVRmJbFUiSUhhRAygwj.jpg",
            is_match: false // This one will not be matched by all
        }
    ];

    const { error: movieErr } = await supabase
        .from("party_candidates")
        .insert(movies);

    if (movieErr) {
        console.error("Could not insert movies into party_candidates:", movieErr);
        return;
    }

    console.log("Successfully inserted 3 candidate movies.");

    // insert swipes for 3 users, all liking all 3 movies
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
            round_id: old_round_id,
        });
        }
    }

    const { error: swipeErr } = await supabase
        .from("swipes")
        .insert(swipe);

    if (swipeErr) {
        console.error("Could not insert movies into swipes:", swipeErr);
        return;
    }

    console.log("Successfully inserted swipes for all 3 users on all 3 movies.");

    // Modify one swipe (one movie not liked by all)
    const { error: modifyErr } = await supabase
        .from("swipes")
        .update({ decision: "skip" })
        .eq("party_id", party_id)
        .eq("tmdb_id", 50619)
        .limit(1);

    if (modifyErr) {
        return console.error("Could not modify swipe:", modifyErr);
    }
    console.log("Modified one swipe to 'skip'");

    console.log("\n Test Data Created Successfully!");
}
main();