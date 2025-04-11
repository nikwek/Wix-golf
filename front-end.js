import wixData from 'wix-data';
import { fetchAndCacheLeaderboard } from 'backend/back-end';

// Fetch the tournament data from the collection
async function tournamentData() {
    const tournamentData = await wixData.query('tournamentData').find();
    console.log('Tournament Data:', tournamentData.items);
    return tournamentData.items;
}

// Function to update player winnings in GolfPicks table

// Modified updatePlayerWinnings to store only numeric values

async function updatePlayerWinnings(filteredLeaderboard) {
    console.log('Updating player winnings in GolfPicks table...');
    
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
            // Removed bet1Total and bet2Total formatted fields
        };
        
        // Update the pick record with winnings while preserving all fields
        await wixData.update("GolfPicks", updatedPick);
    }
}

// Function to check if the current date and time is within the tournament dates and times
async function isWithinTournamentDates(tournament) {
    const now = new Date();
    const startDate = new Date(tournament.startDate);
    const endDate = new Date(tournament.endDate);
    const nowTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startTime = tournament.startTime.split(':').map(Number);
    const endTime = tournament.endTime.split(':').map(Number);
    const startSeconds = startTime[0] * 3600 + startTime[1] * 60 + startTime[2];
    const endSeconds = endTime[0] * 3600 + endTime[1] * 60 + endTime[2];

    if (now >= startDate && now <= endDate) {
        if (nowTime >= startSeconds && nowTime <= endSeconds) {
            console.log('Tournament is active.');
            return true;
        }
    }

    console.log('Tournament is NOT active.');
    return false;
}

// Function to fetch player names from the "GolfPicks" collection
async function fetchPlayerNames() {
    console.log('Fetching player names...');
    return await wixData.query("GolfPicks")
        .find()
        .then((results) => {
            let playerNames = [];

            if (results.items.length > 0) {
                results.items.forEach((item) => {
                    // Add all four players to the set
                    if (item.player1) playerNames.push(item.player1);
                    if (item.player2) playerNames.push(item.player2);
                    if (item.player3) playerNames.push(item.player3);
                    if (item.player4) playerNames.push(item.player4);
                });
            }

            return playerNames;
        })
        .catch((err) => {
            console.error("Error querying the GolfPicks collection:", err);
            return [];
        });
}

// Function to transform the raw leaderboard data into the desired structure
async function transformLeaderboardData(leaderboardData) {
    return leaderboardData.map(player => {
        const rounds = player.rounds || [];
        return {
            rank: player.position ?? 'N/A',
            player_id: player.player_id,
            name: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
            country: player.country ?? 'N/A',
            totalScore: player.total_to_par ?? 'N/A',
            scoreToday: player.strokes ?? 'N/A',
            totalThrough: player.holes_played ?? 'N/A',
            r1: rounds.find(round => round.round_number === 1)?.strokes ?? 'N/A',
            r2: rounds.find(round => round.round_number === 2)?.strokes ?? 'N/A',
            r3: rounds.find(round => round.round_number === 3)?.strokes ?? 'N/A',
            r4: rounds.find(round => round.round_number === 4)?.strokes ?? 'N/A',
            totalStrokes: player.strokes ?? 'N/A'
        };
    });
}

// Function to filter the leaderboard based on the player names
async function filterLeaderboard(leaderboard) {
    const playerNames = await fetchPlayerNames();
    const playerNamesSet = new Set(playerNames);

    const filtered = leaderboard.filter(player => {
        const fullName = `${player.first_name} ${player.last_name}`;
        return playerNamesSet.has(fullName);
    });

    return filtered;
}

// Function to save the filtered leaderboard data to the 'Leaderboard' collection
async function saveToLeaderboard(filteredLeaderboardTable) {
    for (const player of filteredLeaderboardTable) {
        const playerData = {
            rank: player.rank,
            player_id: player.player_id,
            name: player.name,
            country: player.country,
            totalScore: player.totalScore,
            scoreToday: player.scoreToday,
            totalThrough: player.totalThrough,
            r1: player.r1,
            r2: player.r2,
            r3: player.r3,
            r4: player.r4,
            totalStrokes: player.totalStrokes
        };

        try {
            const existingPlayer = await wixData.query("Leaderboard")
                .eq("player_id", player.player_id)
                .find();

            if (existingPlayer.items.length > 0) {
                const playerId = existingPlayer.items[0]._id;
                await wixData.update("Leaderboard", {
                    _id: playerId,
                    ...playerData
                });
            } else {
                await wixData.insert("Leaderboard", playerData);
            }
        } catch (error) {
            console.error(`Error saving player data for ${player.name}:`, error);
        }
    }
}

// Create currency formatter at the top level, outside all functions
const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
});

// Move the helper function outside to avoid inner declarations
function handleRepeaterItem($item, itemData, textElementId, winnings1, winnings2) {
    try {
        // Calculate bet total
        const value1 = Number(itemData[winnings1]) || 0;
        const value2 = Number(itemData[winnings2]) || 0;
        const total = value1 + value2;
        
        // Simple string formatting that should always work
        const formattedValue = "$" + total.toLocaleString();
        
        // Try different ways to set the text
        const textElement = $item(textElementId);
        if (textElement) {
            // Try method 1
            textElement.text = formattedValue;
            
            // Try method 2 (in case method 1 doesn't work)
            setTimeout(() => {
                textElement.text = formattedValue;
            }, 50);
        }
    } catch (err) {
        console.error(`Error in handleRepeaterItem: ${err}`);
    }
}

// Format number as dollar amount with commas
function formatNumber_AsDollar(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update setupRepeaters function to use custom formatting
function setupRepeaters() {
    try {
        // Configure first repeater if it exists
        if ($w("#betRepeater1")) {
            $w("#betRepeater1").onItemReady(($item, itemData, index) => {
                // Calculate total winnings
                const winnings1 = Number(itemData.winnings1) || 0;
                const winnings2 = Number(itemData.winnings2) || 0;
                const total = winnings1 + winnings2;
                
                // Format as dollar amount
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                
                // Set text on the element
                if ($item("#bet1TotalText")) {
                    $item("#bet1TotalText").text = formattedWinnings;
                    console.log(`Set bet1TotalText for index ${index} to ${formattedWinnings}`);
                }
            });
        }
        
        // Configure second repeater if it exists
        if ($w("#betRepeater2")) {
            $w("#betRepeater2").onItemReady(($item, itemData, index) => {
                // Calculate total winnings
                const winnings3 = Number(itemData.winnings3) || 0;
                const winnings4 = Number(itemData.winnings4) || 0;
                const total = winnings3 + winnings4;
                
                // Format as dollar amount
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                
                // Set text on the element
                if ($item("#bet2TotalText")) {
                    $item("#bet2TotalText").text = formattedWinnings;
                    console.log(`Set bet2TotalText for index ${index} to ${formattedWinnings}`);
                }
            });
        }
        
        console.log('Repeaters successfully configured');
    } catch (error) {
        console.error('Error setting up repeaters:', error);
    }
}

$w.onReady(async function () {
    // Set up repeater handlers right away
    setupRepeaters();
    
    try {
        // Get tournament data and check if active
        const tournament = await tournamentData();
        if (await isWithinTournamentDates(tournament[0])) {
            try {
                const leaderboard = await fetchAndCacheLeaderboard(tournament[0]);
                if (leaderboard) {
                    // Process leaderboard data
                    const filteredLeaderboard = await filterLeaderboard(leaderboard);
                    const transformedLeaderboard = await transformLeaderboardData(filteredLeaderboard);
                    
                    // Save to Leaderboard collection
                    await saveToLeaderboard(transformedLeaderboard);
                    
                    // Update player winnings directly in GolfPicks
                    await updatePlayerWinnings(transformedLeaderboard);
                    
                    // Make sure to refresh the dataset that populates the repeaters
                    if ($w("#dataset5")) {
                        $w("#dataset5").refresh();
                        console.log("Dataset refreshed");
                        
                        // If needed, you could force the repeaters to refresh their data display
                        setTimeout(() => {
                            if ($w("#betRepeater1")) $w("#betRepeater1").forceUpdate();
                            if ($w("#betRepeater2")) $w("#betRepeater2").forceUpdate();
                        }, 500);
                    }
                    
                    console.log('Data updated successfully');
                } else {
                    console.log('No updates to the leaderboard.');
                }
            } catch (error) {
                console.error('Error running application:', error);
            }
        } else {
            console.log('Tournament is not active.');
        }
    } catch (error) {
        console.error("Error in onReady:", error);
    }
});

