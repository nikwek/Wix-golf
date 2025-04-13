import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { fetch } from 'wix-fetch';
import { RateLimiter } from "limiter";

// Allow 4 requests per hour (the RapidAPI free requests limit)
const limiter = new RateLimiter({ tokensPerInterval: 4, interval: "hour" });

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

// Function to save leaderboard data
export async function saveLeaderboardData(filteredLeaderboardTable) {
    console.log('Backend: Starting leaderboard data save...'); 
    
    try {
        // First check if players exist
        console.log(`Processing ${filteredLeaderboardTable.length} players`);
        for (const player of filteredLeaderboardTable) {
            try {
                // Check if player exists by player_id
                const existingPlayer = await wixData.query("Leaderboard")
                    .eq("player_id", player.player_id)
                    .find();
                
                if (existingPlayer.items.length > 0) {
                    // Update existing player
                    const playerId = existingPlayer.items[0]._id;
                    
                    const updateResult = await wixData.update("Leaderboard", {
                        _id: playerId,
                        rank: player.rank,
                        player_id: player.player_id,
                        name: player.name,
                        country: player.country,
                        totalScore: player.totalScore,
                        scoreToday: player.scoreToday,
                        totalThrough: player.totalThrough,
                        status: player.status,
                        r1: player.r1,
                        r2: player.r2,
                        r3: player.r3,
                        r4: player.r4,
                        totalStrokes: player.totalStrokes
                    });
                } else {
                    // Insert new player
                    const insertResult = await wixData.insert("Leaderboard", player);
                }
            } catch (playerError) {
                console.error(`Error processing player ${player.name}:`, playerError);
                // Continue with next player
            }
        }
        
        console.log('Backend: Completed leaderboard data save');
        return { success: true };
    } catch (error) {
        console.error('Exception in saveLeaderboardData:', error);
        return { success: false, error: error.toString() };
    }
}

// Function to update player winnings in GolfPicks table
export async function updatePlayerWinnings(filteredLeaderboard) {
    console.log('Updating player winnings in GolfPicks table...');
    
    try {
        // Fetch golf winnings data
        const golfWinningsData = await wixData.query("GolfWinnings").find();
        const winningsMap = new Map();
        
        // Create a map of rank to winnings
        if (golfWinningsData.items.length > 0) {
            golfWinningsData.items.forEach(item => {
                winningsMap.set(item.rank, Number(item.winnings) || 0);
            });
        }
        
        // Create a map of player name to winnings based on their rank
        const playerWinnings = new Map();
        filteredLeaderboard.forEach(player => {
            const winnings = winningsMap.get(player.rank) || 0;
            playerWinnings.set(player.name, Number(winnings));
        });
        
        // Fetch all golf picks
        const golfPicksData = await wixData.query("GolfPicks").find();
        
        // Update each entry with winnings
        for (const pick of golfPicksData.items) {
            // Get winnings for each player
            const winnings1 = playerWinnings.get(pick.player1) || 0;
            const winnings2 = playerWinnings.get(pick.player2) || 0;
            const winnings3 = playerWinnings.get(pick.player3) || 0;
            const winnings4 = playerWinnings.get(pick.player4) || 0;
            
            // Store only numeric values, not formatted strings
            const updatedPick = {
                ...pick,  // Spread operator preserves all existing fields
                winnings1: winnings1,
                winnings2: winnings2,
                winnings3: winnings3,
                winnings4: winnings4
            };
            
            // Update the pick record with winnings while preserving all fields
            await wixData.update("GolfPicks", updatedPick);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Exception in updatePlayerWinnings:', error);
        return { success: false, error: error.toString() };
    }
}

export function simpleTest(data) {
    console.log("Backend simpleTest called with:", data);
    return { received: data, success: true };
}