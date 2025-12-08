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
    Test Script that tests the rounds/nextRound API.
    Run with `npx ts-node scripts/testNextRound.ts`
    Note: This script assumes that test data from createNextRoundTestData.ts already exists.
        Please Run createNextRoundTestData.ts first to set up the necessary data.
*/

const BASE_URL = "http://localhost:3000";
const PARTY_ID = "5b8d55a7-8712-4fa1-92a2-89eea7675acf";
const ROUND_ID = "33c47713-1b4b-472e-9cba-d4c31a95646d"

async function main() {
    console.log("\n Testing rounds/nextRound...\n");

    const supabase = getSupabase();

    // Call the nextRound API
    const url = `${BASE_URL}/api/rounds/nextRound`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            party_id: PARTY_ID,
            round_id: ROUND_ID
        })
    });

    if (!response.ok) {
        console.error("API Error:", response.status, response.statusText);
        const err = await response.text();
        console.log(err);
        return;
    }

    // Obtains all rounds for the party to verify changes
    const { data: rounds, error: roundsErr } = await supabase
        .from("rounds")
        .select("*")
        .eq("party_id", PARTY_ID)
        .order("round_num", { ascending: true });

    if (roundsErr || !rounds) {
        console.error("Could not fetch rounds:", roundsErr);
        return;
    }

    const oldRound = rounds[0];
    const newRound = rounds[1];

    console.log("Old Round:", oldRound);
    console.log("New Round:", newRound);

    // Verify the old round is now inactive
    if (!oldRound || oldRound.is_active !== false) {
        console.error("Error: Old round was NOT deactivated.");
    } else {
        console.log("Old round was correctly deactivated.");
    }

    // Verify the new round is active
    if (!newRound || newRound.is_active !== true) {
        console.error("Error: New round was NOT activated.");
    } else {
        console.log("New round is active.");
    }

    // Check new candidate pool
    const { data: pool, error: poolErr } = await supabase
        .from("party_candidates")
        .select("*")
        .eq("round_id", newRound.round_id);

    if (poolErr) {
        console.error("Could not fetch new pool:", poolErr);
        return;
    }

    console.log("New Round Pool:", pool);

    // Verify the new pool has the expected number of movies (2 matches from previous round)
    if (!pool || pool.length !== 2) {
        console.error("Error: Expected 2 movies in next round.");
    } else {
        console.log("New pool is correct.");
    }

    console.log("\n testNextRound.ts completed.");
}

main();