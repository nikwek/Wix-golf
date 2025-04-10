import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { RateLimiter } from "limiter";

// Allow 4 requests per hour (the RapidAPI free requests limit)
const limiter = new RateLimiter({ tokensPerInterval: 4, interval: "hour" });

// Cache for leaderboard data
let cachedLeaderboard = null;

// Get RapidAPI key
export const getApiKey = async () => {
    const privateKey = await getSecret("rapid_api_key");
    return privateKey;
};

// Function to fetch data from the API with rate limiter
export const fetchLeaderboardData = async (tournament) => {
    try {
        const remainingTokens = await limiter.removeTokens(1);
        if (remainingTokens < 0) {
            console.warn("Rate limit exceeded. Skipping API call.");
            return null;
        }

        const rapidApiKey = await getApiKey();
        const endpointUrl = `https://golf-leaderboard-data.p.rapidapi.com/leaderboard/${tournament.tournamentId}`;
        console.log('Fetching leaderboard from:', endpointUrl); // Debugging: Log the API endpoint
        const response = await fetch(endpointUrl, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': 'golf-leaderboard-data.p.rapidapi.com',
                'x-rapidapi-key': rapidApiKey,
                'useQueryString': true
            }
        });

        if (!response.ok) {
            console.error(`Error fetching leaderboard: ${response.statusText}`);
            throw new Error(`API call failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', data); // Debugging: Log the API response
        return extractLeaderboard(data);
    } catch (error) {
        console.error('Error fetching the leaderboard data:', error);
        throw error;
    }
};

// Function to extract the leaderboard data from the response
export const extractLeaderboard = (data) => {
    if (data && data.results && data.results.leaderboard) {
        console.log('Extracted Leaderboard Data:', data.results.leaderboard); // Debugging: Log the extracted data
        return data.results.leaderboard;
    } else {
        console.error('Invalid data structure or missing leaderboard data');
        return null;
    }
};

// Function to fetch and cache leaderboard data
export const fetchAndCacheLeaderboard = async (tournament) => {
    const leaderboard = await fetchLeaderboardData(tournament);
    if (!leaderboard) return null;

    if (!cachedLeaderboard || JSON.stringify(cachedLeaderboard) !== JSON.stringify(leaderboard)) {
        cachedLeaderboard = leaderboard;
        console.log("Leaderboard updated.");
        return leaderboard;
    } else {
        console.log("No changes in leaderboard data.");
        return null; // No changes
    }
};