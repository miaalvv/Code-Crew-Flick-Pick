import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env.local"),
});

/*
    Test Script that tests the currentRound API.
    Run with `npx ts-node scripts/testCurrentRound.ts`
    Note: This script assumes that test data from createTestData.ts already exists.
        Please Run createTestData.ts first to set up the necessary data.
*/


const BASE_URL = "http://localhost:3000";
const PARTY_ID = "0d93e663-65e1-448a-bfc6-980b8d73611f";

async function testCurrentRound() {
  console.log("\n Testing /api/rounds/currentRound ... \n");

  const url = `${BASE_URL}/api/rounds/currentRound?party_id=${PARTY_ID}`;
  console.log("Calling:", url);

  try {
    const response = await fetch(url);
    const json = await response.json();
    console.log("Response:", json);
  } catch (err) {
    console.error("Error calling API:", err);
  }
}

testCurrentRound();
