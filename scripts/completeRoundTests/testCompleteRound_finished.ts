import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.resolve(__dirname, "../.env.local"),
});

/*
    Test Script that tests completing a round that is finished.
    Run with `npx ts-node scripts/completeRoundTests/testCompleteRound_finished.ts`
    Note: This script assumes that test data from createTestData.ts already exists.
        Please Run createTestData.ts first to set up the necessary data.
*/

const BASE_URL = "http://localhost:3000";
const PARTY_ID = "0d93e663-65e1-448a-bfc6-980b8d73611f";
const ROUND_ID = "9b3f9934-22ae-4a41-ac95-93feae13faa5";

async function testCompleteRound() {
    console.log("\n Testing /api/rounds/completeRound - Round IS Finished ... \n");

    const url = `${BASE_URL}/api/rounds/completeRound?party_id=${PARTY_ID}&round_id=${ROUND_ID}`;
    console.log("Calling:", url);

    try {
        const response = await fetch(url);
        const json = await response.json();

        console.log("Response JSON:", json);

        if (json.isRoundComplete === true) {
            console.log("Round is complete.");
        } else {
            console.log("Error: Round was NOT marked complete.");
        }

  } catch (err) {
        console.error("Error calling API:", err);
  }

  console.log("\n Test Complete Round Finished script finished.");
}

testCompleteRound()