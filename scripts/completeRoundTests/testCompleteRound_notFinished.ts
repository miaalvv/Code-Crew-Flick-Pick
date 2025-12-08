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
    Test Script that tests completing a round that is NOT finished.
    Run with `npx ts-node scripts/completeRoundTests/testCompleteRound_notFinished.ts`
    Note: This script assumes that test data from createTestData.ts already exists.
        Please Run createTestData.ts first to set up the necessary data.
*/

const supabase = getSupabase();


console.log("\n Testing /api/rounds/completeRound - Round is NOT Finished ... \n");

const BASE_URL = "http://localhost:3000";
const PARTY_ID = "0d93e663-65e1-448a-bfc6-980b8d73611f";  
const ROUND_ID = "9b3f9934-22ae-4a41-ac95-93feae13faa5";

// The swipe record we will temporarily delete
const testSwipe = {
    PARTY_ID,
    ROUND_ID,
    user_id: "edde38d6-b4bc-41b8-83cd-cfa90bee289a",
    tmdb_id: 12,
    media_type: "movie",
    title: "Finding Nemo",
    poster_path: "/eHuGQ10FUzK1mdOY69wF5pGgEf5.jpg",
    decision: "like",
};

// Delete one swipe to simulate an unfinished round
async function deleteOneSwipe() {
    console.log("Deleting ONE swipe to simulate incomplete round...");

    const { error } = await supabase
        .from("swipes")
        .delete()
        .match({
            party_id: testSwipe.PARTY_ID,
            round_id: testSwipe.ROUND_ID,
            user_id: testSwipe.user_id,
            tmdb_id: testSwipe.tmdb_id,
            media_type: testSwipe.media_type,
        });

    if (error) {
        console.error("Failed to delete swipe:", error);
    } else {
        console.log("Swipe deleted successfully");
    }
}

// Restore the deleted swipe after the test
async function restoreSwipe() {
    console.log("Restoring deleted swipe...");

    const { error } = await supabase
        .from("swipes")
        .insert(testSwipe);

    if (error) {
        console.error("Failed to restore swipe:", error);
    } else {
        console.log("Swipe restored successfully");
    }
}

// Test the completeRound API for an unfinished round
async function testCompleteRound() {

    const url = `${BASE_URL}/api/rounds/completeRound?party_id=${PARTY_ID}&round_id=${ROUND_ID}`;
    console.log("Calling:", url);

    const res = await fetch(url);
    const json = await res.json();

    console.log("API Response:", json);

    if (json.isRoundComplete === false) {
        console.log("Round correctly flagged as NOT finished.");
    } else {
        console.log("Error: Round incorrectly flagged as complete.");
    }
}

async function main() {
    await deleteOneSwipe();
    await testCompleteRound();
    await restoreSwipe(); // Restore original state
}

main();