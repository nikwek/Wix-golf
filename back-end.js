import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { RateLimiter } from "limiter";


// Allow 4 requests per hour (the RapidAPI free requests limit). Also understands
// 'second', 'minute', 'day', or a number of milliseconds
const limiter = new RateLimiter({ tokensPerInterval: 4, interval: "hour" });

// Get RapidAPI key
export const getApiKey = async () => {
  const privateKey = await getSecret("rapid_api_key");
  return privateKey;
}

// Function to fetch data from the API with rate limiter 
export const fetchLeaderboardData = async (tournament) => {
  try {
    // const remainingMessages = await limiter.removeTokens(1);
    const rapidApiKey = await getApiKey();
    console.log(tournament.tournamentId);
    const endpointUrl = `https://golf-leaderboard-data.p.rapidapi.com/leaderboard/${tournament.tournamentId}`;
    console.log(endpointUrl);
    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'golf-leaderboard-data.p.rapidapi.com',
        'x-rapidapi-key': rapidApiKey,
        'useQueryString': true
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const leaderboard = await extractLeaderboard(data);
    console.log('leaderboard data extracted...');
    return leaderboard;
  } catch (error) {
    console.error('Error fetching the leaderboard data:', error);
    throw error;
  }
}

// Function to extract the leaderboard data from the response
export const extractLeaderboard = (data) => {
  if (data && data.results && data.results.leaderboard) {
    return data.results.leaderboard;
  } else {
    console.error('Invalid data structure or missing leaderboard data');
    return null;
  }
}