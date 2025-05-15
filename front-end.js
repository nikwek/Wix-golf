import wixData from 'wix-data';
import { fetchLeaderboardData, saveLeaderboardData, updatePlayerWinnings, simpleTest } from 'backend/back-end';

// Fetch the tournament data from the collection
async function tournamentData() {
    const tournamentData = await wixData.query('tournamentData').find();
    console.log('Tournament Data:', tournamentData.items);
    return tournamentData.items;
}

// Function to check if the current date and time is within the tournament dates and times
async function isWithinTournamentDates(tournament) {
    // Get the current date in the user's local time
    const now = new Date();
    
    // Convert tournament dates from stored format to Date objects
    const startDate = new Date(tournament.startDate);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(tournament.endDate);
    endDate.setHours(23, 59, 59, 999);
    
    const nowTime = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const startTime = tournament.startTime.split(':').map(Number);
    const endTime = tournament.endTime.split(':').map(Number);
    const startSeconds = startTime[0] * 3600 + startTime[1] * 60 + (startTime[2] || 0);
    const endSeconds = endTime[0] * 3600 + endTime[1] * 60 + (endTime[2] || 0);

    // Debug output to see what's happening
    console.log('Now:', now);
    console.log('Start Date:', startDate);
    console.log('End Date:', endDate);
    console.log('Tournament times:', startSeconds, 'to', endSeconds);
    console.log('Tournament dates:', startDate, 'to', endDate);
    console.log('Date check:', now >= startDate && now <= endDate);
    console.log('Time check:', nowTime >= startSeconds && nowTime <= endSeconds);

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
        
        // Determine player status
        let status = (player.status || "active").toLowerCase().trim();
        
        // Set scoreToday and totalThrough based on status
        let scoreToday;
        let totalThrough;
        
        if (status === "cut") {
            scoreToday = "CUT";
            totalThrough = "-"; // Add this for consistency
        } else if (status === "notstarted") { 
            scoreToday = "-";
            totalThrough = String(rounds.find(round => round.round_number === player.current_round)?.tee_time_local || "TBD");
        } else {
            // For active players
            scoreToday = String(rounds.find(round => round.round_number === player.current_round)?.total_to_par || 0);
            
            // Use holes_played directly, with fallback
            if (player.holes_played === 18) {
                totalThrough = "F";
            } else {
                totalThrough = player.holes_played ? String(player.holes_played) : "-";
            }
        }
        
        return {
            rank: player.position ?? 'N/A',
            player_id: player.player_id,
            name: `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
            country: player.country ?? 'N/A',
            totalScore: player.total_to_par ?? 'N/A',
            scoreToday: scoreToday,
            totalThrough: totalThrough,
            status: status,
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
    console.log('Filtering leaderboard data...');
    const playerNames = await fetchPlayerNames();
    const playerNamesSet = new Set(playerNames);
    const filtered = leaderboard.filter(player => {
        const fullName = `${player.first_name} ${player.last_name}`;
        
        // Check if name exists directly
        if (playerNamesSet.has(fullName)) {
            return true;
        }
        
        // Try with normalized character handling
        const normalizedName = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        
        // Check normalized version of player names
        for (const dbName of playerNamesSet) {
            // Normalize database name too
            const normalizedDbName = dbName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            
            if (normalizedName === normalizedDbName) {
                console.log(`Matched special character name: ${fullName} (API) with ${dbName} (DB)`);
                return true;
            }
        }

        return false;
    });
    
    console.log(`Found ${filtered.length} players from ${leaderboard.length} total`);
    
    // Debug: Log filtered players
    console.log('Filtered players:', filtered.map(p => `${p.first_name} ${p.last_name} (ID: ${p.player_id})`));
    
    return filtered;
}

// Create currency formatter at the top level, outside all functions
const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
});

// Format number as dollar amount with commas
function formatNumber_AsDollar(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Update setupWinningsDisplay function to use custom formatting
function setupWinningsDisplay($item, itemData, winnings1Field, winnings2Field, textElementId, index) {
    // Calculate total winnings
    const value1 = Number(itemData[winnings1Field]) || 0;
    const value2 = Number(itemData[winnings2Field]) || 0;
    const total = value1 + value2;
    
    // Format as dollar amount
    const formattedWinnings = "$" + formatNumber_AsDollar(total);
    
    // Set text on the element
    if ($item(textElementId)) {
        $item(textElementId).text = formattedWinnings;
    }
}

// Update setupRepeaters function to use the helper
function setupRepeaters() {
    try {
        // Configure first repeater if it exists
        if ($w("#betRepeater1")) {
            $w("#betRepeater1").onItemReady(($item, itemData, index) => {
                setupWinningsDisplay($item, itemData, "winnings1", "winnings2", "#bet1TotalText", index);
            });
        }
        
        // Configure second repeater if it exists
        if ($w("#betRepeater2")) {
            $w("#betRepeater2").onItemReady(($item, itemData, index) => {
                setupWinningsDisplay($item, itemData, "winnings3", "winnings4", "#bet2TotalText", index);
            });
        }
        
        console.log('Repeaters successfully configured');
    } catch (error) {
        console.error('Error setting up repeaters:', error);
    }
}

// Updated function to refresh the repeaters using dataset approach
function refreshRepeaters() {
    try {
        console.log('Attempting to refresh repeaters via datasets...');
        
        // Try to refresh any datasets that might be bound to the repeaters
        let refreshed = false;
        
        // Common dataset names in Wix (try all possible dataset names)
        const possibleDatasets = [
            "#dataset1", "#dataset2", "#dataset3", "#golfPicksDataset", 
            "#betRepeater1Dataset", "#betRepeater2Dataset", "#leaderboardDataset",
            "#GolfPicksDataset", "#golfDataset"
        ];
        
        // Try to find and refresh each possible dataset
        for (const datasetId of possibleDatasets) {
            try {
                if ($w(datasetId)) {
                    console.log(`Found dataset ${datasetId}, attempting to refresh...`);
                    $w(datasetId).refresh();
                    refreshed = true;
                    console.log(`Successfully refreshed dataset ${datasetId}`);
                }
            } catch (err) {
                // Silently ignore if dataset doesn't exist
            }
        }
        
        // If we couldn't find a dataset to refresh, try to refresh parent datasets
        if (!refreshed) {
            try {
                if ($w("#dynamicDataset")) {
                    $w("#dynamicDataset").refresh();
                    refreshed = true;
                    console.log('Refreshed dynamicDataset');
                }
            } catch (err) {
                // Ignore
            }
            
            // As a last resort, try to refresh the page through a message to the user
            if (!refreshed) {
                console.log('Could not find any datasets to refresh. Data has been updated in the database.');
                console.log('Manual page refresh may be needed to see updated data.');
                
                // Optionally, show a message to the user
                try {
                    if ($w("#updateMessage")) {
                        $w("#updateMessage").text = "Data updated. Refresh page to see latest results.";
                        $w("#updateMessage").show();
                    }
                } catch (err) {
                    // Ignore if element doesn't exist
                }
            }
        }
    } catch (error) {
        console.error('Error refreshing datasets:', error);
    }
}

$w.onReady(async function () {
    try {
        // Set up repeater handlers first
        setupRepeaters();
        
        // Get tournament data and check if active
        const tournament = await tournamentData();
        if (await isWithinTournamentDates(tournament[0])) {
            try {
                console.log('Tournament is active, fetching leaderboard data...');
                
                const leaderboard = await fetchLeaderboardData(tournament[0]);
                if (leaderboard) {
                    // Process leaderboard data
                    const filteredLeaderboard = await filterLeaderboard(leaderboard);
                    const transformedLeaderboard = await transformLeaderboardData(filteredLeaderboard);

                    // Save data to database
                    try {
                        console.log('Saving leaderboard data to database...');
                        const result = await saveLeaderboardData(transformedLeaderboard);
                        
                        console.log('Updating player winnings based on player IDs...');
                        // Update winnings (only once)
                        const winningsResult = await updatePlayerWinnings(transformedLeaderboard);
                        
                        if (winningsResult.success) {
                            console.log('Winnings updated successfully, attempting to refresh display...');
                            // After updating the database, try to refresh any bound datasets
                            refreshRepeaters();
                        } else {
                            console.error('Failed to update winnings:', winningsResult.error);
                        }
                    } catch (error) {
                        console.error('ERROR updating data:', error);
                    }
                } else {
                    console.log('No leaderboard data available.');
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