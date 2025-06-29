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
        console.log('Fetching leaderboard from:', endpointUrl);
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
        console.log('API Response received');
        return extractLeaderboard(data);
    } catch (error) {
        console.error('Error fetching the leaderboard data:', error);
        throw error;
    }
};

// Function to extract the leaderboard data from the response
export const extractLeaderboard = (data) => {
    if (data && data.results && data.results.leaderboard) {
        console.log('Extracted Leaderboard Data');
        return data.results.leaderboard;
    } else {
        console.error('Invalid data structure or missing leaderboard data');
        return null;
    }
};

// Function to save leaderboard data to Leaderboard collection
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

// Improved function to update player winnings in GolfPicks table using player IDs
export async function updatePlayerWinnings(filteredLeaderboard) {
    console.log('Updating player winnings in GolfPicks table using player IDs...');
    
    try {
        // Step 1: Fetch ALL golf winnings data
        console.log("Fetching golf winnings data...");
        const golfWinningsData = await wixData.query("GolfWinnings")
            .limit(1000) // Increased limit to ensure we get all records
            .find();
        
        console.log(`Total rows fetched from GolfWinnings table: ${golfWinningsData.items.length}`);
        
        // Debug the first item to confirm field structure
        if (golfWinningsData.items.length > 0) {
            const firstItem = golfWinningsData.items[0];
            console.log("First item from GolfWinnings:");
            console.log(JSON.stringify(firstItem));
        }
        
        // Create a map of rank to winnings
        const winningsMap = new Map();
        let maxRankFound = 0;
        
        // Process all items using the correct field IDs
        golfWinningsData.items.forEach((item, index) => {
            const rankValue = item.rank; // Using lowercase field ID
            const winningsValue = item.winnings; // Using lowercase field ID
            
            // Convert to numbers if needed
            const rank = typeof rankValue === 'string' ? parseInt(rankValue, 10) : rankValue;
            const winnings = typeof winningsValue === 'string' ? 
                parseFloat(winningsValue.replace(/[$,]/g, '')) : // Remove $ and commas if it's a string
                Number(winningsValue);
            
            if (!isNaN(rank) && !isNaN(winnings)) {
                winningsMap.set(rank, winnings);
                maxRankFound = Math.max(maxRankFound, rank);
                
                // Log a few samples for verification
                if (index < 3 || index >= golfWinningsData.items.length - 3) {
                    console.log(`Rank ${rank}: $${winnings}`);
                } else if (index === 3) {
                    console.log("..."); // Indicate skipping middle items in log
                }
            } else {
                console.log(`WARNING: Invalid rank or winnings at row ${index + 1}: Rank=${rankValue}, Winnings=${winningsValue}`);
            }
        });
        
        console.log(`Processed ${winningsMap.size} valid rank-to-winnings mappings`);
        console.log(`Maximum rank with winnings: ${maxRankFound}`);
        
        // Step 2: Get all players from the Leaderboard collection
        const leaderboardPlayers = await wixData.query("Leaderboard").find({ limit: 1000 });
        
        // Create maps for lookup
        const playerIdToName = new Map();
        const playerNameToId = new Map();
        const playerIdToRankWinnings = new Map();
        
        // Map player IDs to names from Leaderboard collection
        if (leaderboardPlayers.items.length > 0) {
            leaderboardPlayers.items.forEach(player => {
                if (player.player_id && player.name) {
                    playerIdToName.set(player.player_id, player.name);
                    playerNameToId.set(player.name, player.player_id);
                    
                    // Also add normalized versions of the name for better matching
                    const normalizedName = player.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
                    if (normalizedName !== player.name) {
                        playerNameToId.set(normalizedName, player.player_id);
                    }
                    
                    // Add lowercase version
                    playerNameToId.set(player.name.toLowerCase(), player.player_id);
                }
            });
        }
        
        console.log(`Loaded ${playerIdToName.size} players from Leaderboard collection`);
        
        // Step 3: Map player IDs to ranks and winnings from the filtered leaderboard data
        filteredLeaderboard.forEach(player => {
            // Convert rank to number if needed
            const rankValue = player.rank;
            const rank = typeof rankValue === 'string' ? parseInt(rankValue, 10) : rankValue;
            const playerId = player.player_id;
            
            // Check if the rank is valid and in the winnings map
            const hasWinnings = !isNaN(rank) && winningsMap.has(rank);
            const winnings = hasWinnings ? winningsMap.get(rank) : 0;
            
            if (playerId) {
                playerIdToRankWinnings.set(playerId, {
                    rank: rank,
                    winnings: winnings
                });
                
                console.log(`Player ID ${playerId} (${player.name}) has rank ${rank} and winnings $${winnings}`);
            }
        });
        
        // Step 4: Get all player picks
        const golfPicksData = await wixData.query("GolfPicks").find();
        
        // Step 5: Update each entry with winnings
        console.log("\nUpdating Golf Picks with calculated winnings:");
        for (const pick of golfPicksData.items) {
            console.log(`\nProcessing pick for ${pick.name}:`);
            
            // First try to find player IDs using player name lookup
            // Then lookup winnings using player IDs
            const playerId1 = getPlayerIdFromName(pick.player1, playerNameToId);
            const playerId2 = getPlayerIdFromName(pick.player2, playerNameToId);
            const playerId3 = getPlayerIdFromName(pick.player3, playerNameToId);
            const playerId4 = getPlayerIdFromName(pick.player4, playerNameToId);
            
            // Lookup winnings based on player IDs
            const winnings1 = getWinningsFromPlayerId(playerId1, playerIdToRankWinnings);
            const winnings2 = getWinningsFromPlayerId(playerId2, playerIdToRankWinnings);
            const winnings3 = getWinningsFromPlayerId(playerId3, playerIdToRankWinnings);
            const winnings4 = getWinningsFromPlayerId(playerId4, playerIdToRankWinnings);
            
            console.log(`Player 1: ${pick.player1} (ID: ${playerId1 || 'Not found'}) - Winnings: $${winnings1}`);
            console.log(`Player 2: ${pick.player2} (ID: ${playerId2 || 'Not found'}) - Winnings: $${winnings2}`);
            if (pick.player3) console.log(`Player 3: ${pick.player3} (ID: ${playerId3 || 'Not found'}) - Winnings: $${winnings3}`);
            if (pick.player4) console.log(`Player 4: ${pick.player4} (ID: ${playerId4 || 'Not found'}) - Winnings: $${winnings4}`);
            
            // Calculate totals for logging
            const totalWinnings = winnings1 + winnings2 + winnings3 + winnings4;
            console.log(`Total winnings for ${pick.name}: $${totalWinnings}`);
            
            // Update the pick record with winnings using the correct field IDs
            const updatedPick = {
                ...pick,  // Preserve all existing fields
                winnings1: winnings1,
                winnings2: winnings2,
                winnings3: winnings3,
                winnings4: winnings4
            };
            
            try {
                const updateResult = await wixData.update("GolfPicks", updatedPick);
                console.log(`Updated ${pick.name}'s winnings successfully`);
            } catch (updateError) {
                console.error(`Error updating ${pick.name}'s winnings:`, updateError);
                console.error('Error details:', JSON.stringify(updateError));
            }
        }
        
        // Log the Golf Picks table again to verify the update
        const updatedPicksData = await wixData.query("GolfPicks").find();
        
        console.log("\nVerifying updated picks data:");
        updatedPicksData.items.forEach(pick => {
            const totalWinnings = (pick.winnings1 || 0) + (pick.winnings2 || 0) + (pick.winnings3 || 0) + (pick.winnings4 || 0);
            console.log(`${pick.name}: $${totalWinnings} (${pick.winnings1 || 0}, ${pick.winnings2 || 0}, ${pick.winnings3 || 0}, ${pick.winnings4 || 0})`);
        });
        
        return { success: true };
    } catch (error) {
        console.error('Exception in updatePlayerWinnings:', error);
        return { success: false, error: error.toString() };
    }
}

// Helper function to get player ID from name
function getPlayerIdFromName(playerName, playerNameToIdMap) {
    if (!playerName) return null;
    
    // Try direct lookup
    if (playerNameToIdMap.has(playerName)) {
        return playerNameToIdMap.get(playerName);
    }
    
    // Try normalized version
    const normalizedName = playerName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    if (playerNameToIdMap.has(normalizedName)) {
        return playerNameToIdMap.get(normalizedName);
    }
    
    // Try lowercase version
    if (playerNameToIdMap.has(playerName.toLowerCase())) {
        return playerNameToIdMap.get(playerName.toLowerCase());
    }
    
    console.log(`WARNING: Could not find player ID for "${playerName}"`);
    return null;
}

// Helper function to get winnings from player ID
function getWinningsFromPlayerId(playerId, playerIdToRankWinningsMap) {
    if (!playerId) return 0;
    
    const playerData = playerIdToRankWinningsMap.get(playerId);
    if (playerData) {
        return playerData.winnings;
    }
    
    return 0;
}

export function simpleTest(data) {
    console.log("Backend simpleTest called with:", data);
    return { received: data, success: true };
}