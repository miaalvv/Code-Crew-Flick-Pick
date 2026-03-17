// app/api/party/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function sb(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: auth } } }
  );
}

// Builds the weights for each preference based on how many users in the party selected a specific preference
function buildPreferenceWeights (preferencesList: any [], partySize: number) {
  const weights = {
    genres: new Map <number, number> (),
    actors: new Map <number, number> (),
    directors: new Map <number, number> (),
    studios: new Map <number, number> (),
    providers: new Map <number, number> (),
    keywords: new Map <number, number> (),
    decades: [] as { startYear: number; endYear: number } [],
    durations: { min_duration: 1000, max_duration: 0 },
    partySize: preferencesList.length
  };

  // Loops through all preferences to set the weights for each of them
  for (const prefs of preferencesList) {

    // Setting the weight for genres
    for (const g of prefs.genres ?? []) {

      weights.genres.set (
        g.genre_id, (weights.genres.get (g.genre_id) ?? 0) + 1
      )
    }

    // Setting the weight for actors
    for (const a of prefs.actors ?? []) {

      weights.actors.set (
        a.actor_id, (weights.actors.get (a.actor_id) ?? 0) + 1
      );
    }

    // Setting the weight for directors
    for (const d of prefs.directors ?? []) {

      weights.directors.set (
        d.director_id, (weights.directors.get (d.director_id) ?? 0) + 1
      );
    }

    // Setting the weight for studios
    for (const s of prefs.studios ?? []) {

      weights.studios.set (
        s.studio_id, (weights.studios.get (s.studio_id) ?? 0) + 1
      );
    }

    // Setting the weight for providers
    for (const p of prefs.providers ?? []) {

      weights.providers.set (
        p.provider_id, (weights.providers.get (p.provider_id) ?? 0) + 1
      );
    }

    // Setting the weight for keywords
    for (const k of prefs.keywords ?? []) {

      weights.keywords.set (
        k.keyword_id, (weights.keywords.get (k.keyword_id) ?? 0) + 1
      );
    }

    if (prefs.decades) {
      for (const d of prefs.decades) {
        weights.decades.push ({ startYear: d.start_year, endYear: d.end_year});
      }
    }

    if (prefs.durations) {
      
      weights.durations.min_duration = Math.min (
        weights.durations.min_duration, prefs.durations.min_duration ?? weights.durations.min_duration
      );

      weights .durations.max_duration = Math.max (
        weights.durations.max_duration, prefs.durations.max_duration ?? 1000
      );
    }

  }

  return weights

}

// Fetches all party members' preferences
async function getMergedPreferences (
  supabase: ReturnType <typeof sb>,
  partyId: string
) {

  const { data: members, error } = await supabase
    .from ("party_members")
    .select ("user_id")
    .eq ("party_id", partyId);

  if (error || !members) throw new Error ("Failed to get party members");

  const userIds = members.map (m => m.user_id);

  // Fetch preferences from all 8 preference tables
  const [
    genresRes,
    actorsRes,
    directorsRes,
    studiosRes,
    keywordsRes,
    providersRes,
    decadesRes,
    durationsRes
  ] = await Promise.all ([
    supabase.from ("user_genres").select ("*").in ("user_id", userIds),
    supabase.from ("user_actors").select ("*").in ("user_id", userIds),
    supabase.from ("user_directors").select ("*").in ("user_id", userIds),
    supabase.from ("user_studios").select ("*").in ("user_id", userIds),
    supabase.from ("user_keywords").select ("*").in ("user_id", userIds),
    supabase.from ("user_providers").select ("*").in ("user_id", userIds),
    supabase.from ("user_decades").select ("*").in ("user_id", userIds),
    supabase.from ("user_durations").select ("*").in ("user_id", userIds),
  ]);

  // Merge into one list
  const preferencesList: any [] = [];

  for (const uid of userIds) {

    preferencesList.push ({
      genres: (genresRes.data ?? []).filter (g => g.user_id === uid),
      actors: (actorsRes.data ?? []).filter (a => a.user_id === uid),
      directors: (directorsRes.data ?? []).filter (d => d.user_id === uid),
      studios: (studiosRes.data ?? []).filter (s => s.user_id === uid),
      keywords: (keywordsRes.data ?? []).filter (k => k.user_id === uid),
      providers: (providersRes.data ?? []).filter (p => p.user_id === uid),
      decades: (decadesRes.data ?? []).filter (de => de.user_id === uid),
      durations: (durationsRes.data ?? []).find (du => du.user_id === uid),
    });
  }

  return buildPreferenceWeights (preferencesList, userIds.length);

}

 
async function fetchMovieDetails (movieId: number, apiKey: string) {
  const headers = {
    accept: "application/json",
    Authorization: `Bearer ${apiKey}`
  };

  const [detailsRes, creditsRes, keywordsRes, providersRes] = await Promise.all ([
    fetch (`https://api.themoviedb.org/3/movie/${movieId}`, { headers}),
    fetch (`https://api.themoviedb.org/3/movie/${movieId}/credits`, { headers}),
    fetch (`https://api.themoviedb.org/3/movie/${movieId}/keywords`, { headers}),
    fetch (`https://api.themoviedb.org/3/movie/${movieId}/watch/providers`, { headers}),
  ]);

  const details = await detailsRes.json ();
  const credits = await creditsRes.json ();
  const keywords = await keywordsRes.json ();
  const providers = await providersRes.json ();

  return {
    runtime: details.runtime,
    studios: details.production_companies?.map ((c: any) => c.id) ?? [],
    actors: credits.cast?.slice (0, 10).map ((a: any) => a.id) ?? [],
    directors: credits.crew?.filter ((c: any) => c.job === "Director").map ((d: any) => d.id) ?? [],
    keywords: keywords.keywords?.map ((k: any) => k.id) ?? [],
    providers: providers.results?.US?.flatrate?.map ((p: any) => p.provider_id) ?? []
  };
}

// Fetching random movies and scoring them
async function fetchRandomMovies(count: number, preferences: any) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB_API_KEY not configured");

  const moviesMap = new Map <number, any> ();

  for (let attempt = 0; attempt < 5 && moviesMap.size < count * 10; attempt++) {
    
    // pick a random page of popular movies (1–50 is safe enough)
    const page = Math.floor(Math.random() * 50) + 1;

    const res = await fetch(
      `https://api.themoviedb.org/3/discover/movie?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc&vote_count.gte=500`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!res.ok) continue;
    const data = await res.json ();
    
    for (const m of data.results ?? []) {
      if (!moviesMap.has (m.id)) moviesMap.set (m.id, {...m, score: 0});
    } 
  }

  const movies = Array.from (moviesMap.values ());

  const detailPromises = movies.map ((m) => fetchMovieDetails (m.id, apiKey));

  const movieDetails = await Promise.all (detailPromises);

  for (let i = 0; i < movies.length; i++) {

    const movie = movies [i];
    const details = movieDetails [i];
    let score = 0;

    // Genre score calculation for movie
    for (const g of movie.genre_ids ?? []) {

      const weight = preferences.genres.get (g) ?? 0;
      if (weight > 0) score += weight * weight;
    }

    // Decades score calculation for movie
    if (preferences.decades?.length && movie.release_date) {
      const year = parseInt (movie.release_date.slice (0, 4));
      if (preferences.decades.some ((de: any) => year >= de.startYear && year <= de.endYear)) score += 2;
    }

    // Providers score calculation for movie
    for (const p of details.providers) {
      const weight = preferences.providers.get (p) ?? 0;
      if (weight > 0) score += weight * weight
    }

    // Keywords score calculation for movie
    for (const k of details.keywords) {
      const weight = preferences.keywords.get (k) ?? 0;
      if (weight > 0) score +=  weight * weight;
    }


    // Actors score calculation for movie 
    for (const a of details.actors) {
      const weight = preferences.actors.get (a) ?? 0;
      if (weight > 0) score +=  weight * weight;
    }
  

    // Directors score calculation for movie 
    for (const d of details.directors) {
      const weight = preferences.directors.get (d) ?? 0;
      if (weight > 0) score +=  weight * weight;
    }


    // Studios score calculation for movie 
    for (const s of details.studios) {
      const weight = preferences.studios.get (s) ?? 0;
      if (weight > 0) score +=  weight * weight;
    }


    // Duration score calculation
    if (details.runtime) {
     
      if (details.runtime >= preferences.durations.min_duration && details.runtime <= preferences.durations.max_duration) {score += 2;}
    }

    // Bonus if everyone contains the same preference
    const majorityThreshold = Math.ceil (preferences.partySize / 2);
    if (score >= majorityThreshold * 2) score += 5;

    movie.score = score;

  }

  const sortedMovies = movies.sort ((a, b) => b.score - a.score);

  // map to our candidate shape and sorted
  return sortedMovies.slice(0, count).map((m) => ({
    tmdb_id: m.id,
    media_type: "movie" as const,
    title: m.title ?? m.name ?? "Untitled",
    poster_path: m.poster_path ?? null,
  }));
}

export async function POST(req: Request) {
  const supabase = sb(req);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: any = {};
  try { body = await req.json(); } catch {}

  const name = (body?.name ?? "Movie Night").toString();
  const movieCount = Number(body?.movieCount) || 10; // default 10 movies at a time per round (change this number to increase pool)

  // 1) create party in "lobby" state, with 0 rounds started
  const { data: partyRow, error: partyErr } = await supabase
    .from("parties")
    .insert({
      name,
      session_state: "lobby",
      current_round_num: 0,
      owner_id: user.id,      // optional
      created_by: user.id,    // optional
    })
    .select()
    .single();

  if (partyErr || !partyRow) {
    return NextResponse.json(
      { ok: false, error: partyErr?.message ?? "Failed to create party" },
      { status: 400 }
    );
  }

  const party = partyRow;

  // 2) add creator as host
  const { error: memberErr } = await supabase
    .from("party_members")
    .insert({
      party_id: partyRow.id,
      user_id: user.id,
      role: "host",
    });

  if (memberErr) {
    return NextResponse.json(
      { ok: false, error: memberErr.message },
      { status: 400 }
    );
  }

  // 3) initialize round 1 (NEW)
  const { data: roundRow, error: roundErr } = await supabase
    .from("rounds")
    .insert({
      party_id: party.id,
      round_num: 1,
      is_active: true,
    })
    .select()
    .single();

  if (roundErr || !roundRow) {
    return NextResponse.json({ ok: false, error: "failed to create Round 1" }, { status: 400 });
  }
  const round_id = roundRow.round_id;

  // 4) Merge party members' preferences
  let mergedPreferences;
  try { mergedPreferences = await getMergedPreferences (supabase, party.id); }
  catch (err: any) {console.error ("Failed to merge preferences:", err); mergedPreferences = buildPreferenceWeights ([], 1);}

  // 5) fetch random movies from TMDB and seed party_candidates
  try {
    const candidates = await fetchRandomMovies(movieCount, mergedPreferences);
    const rows = candidates.map((c) => ({
      party_id: party.id,
      tmdb_id: c.tmdb_id,
      media_type: c.media_type,
      title: c.title,
      poster_path: c.poster_path,
      round_id, // NEW
    }));

    const { error: candErr } = await supabase
      .from("party_candidates")
      .insert(rows);

    if (candErr) {
      return NextResponse.json(
        { ok: false, error: candErr.message },
        { status: 400 }
      );
    }
  } catch (err: any) {
    console.error("Error seeding TMDB movies:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Failed to seed movies" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    party_id: partyRow.id,
    invite_code: partyRow.invite_code,
  });
}

