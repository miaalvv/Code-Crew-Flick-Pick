// app/_lib/roundsApi.ts
export type RoundRow = {
  round_id: string;
  party_id: string;
  round_num: number;
  is_active: boolean;
};

type CurrentRoundResponse = {
  ok: boolean;
  error?: string;
  round: RoundRow | null;
};

type CompleteRoundResponse = {
  ok: boolean;
  error?: string;
  isRoundComplete?: boolean;
  isSessionFinished?: boolean;
  winner?: any | null;
};

type NextRoundResponse = {
  ok: boolean;
  error?: string;
  new_round?: RoundRow;
};

// Fetches the current round number for a given party
export async function getCurrentRound(
  party_id: string
): Promise<CurrentRoundResponse> {
  const res = await fetch("/api/rounds/currentRound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party_id }),
  });

  const data = await res.json();
  console.log("getCurrentRound response", data);
  return data;
}

// Verifies whether a round is complete and ends session if finished
export async function completeRound(
  party_id: string,
  round_id: string
): Promise<CompleteRoundResponse> {
  const res = await fetch("/api/rounds/completeRound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party_id, round_id }),
  });

  const data = await res.json();
  console.log("completeRound response", data);
  return data;
}

// Advances session to the next round
export async function nextRound(
  party_id: string,
  round_id: string
): Promise<NextRoundResponse> {
  const res = await fetch("/api/rounds/nextRound", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ party_id, round_id }),
  });

  const data = await res.json();
  console.log("nextRound response", data);
  return data;
}
