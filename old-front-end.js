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
        let teeTime;
        teeTime = "--:--";
        teeTime = String(rounds.find(round => round.round_number === player.current_round)?.tee_time_local || "--:--");
        
        if (status === "cut") {
            scoreToday = "CUT";
            totalThrough = "-"; // Add this for consistency
        } else if (status === "notstarted") { 
            scoreToday = "-";
            totalThrough = teeTime;
        } else if (status === "between rounds") { 
            scoreToday = "-";
            totalThrough = teeTime;
        } else if (status === "complete") { 
            totalThrough = "F";
            scoreToday = String(rounds.find(round => round.round_number === player.current_round)?.total_to_par || 0);
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
        console.log(`status: ${status} | totalThrough: ${totalThrough} | Score Today: ${scoreToday}`);
        
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

// Format number as dollar amount with commas
function formatNumber_AsDollar(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Create currency formatter at the top level, outside all functions
const USDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
});

// Query data directly and populate repeaters
async function refreshRepeaterData() {
    try {
        console.log('Directly refreshing repeater data from database...');
        
        // Fetch the latest data directly from the database
        const golfPicksData = await wixData.query("GolfPicks").find();
        console.log(`Fetched ${golfPicksData.items.length} items from GolfPicks collection`);
        
        // Check if we have repeaters to update
        let repeater1Exists = false;
        let repeater2Exists = false;
        
        try {
            repeater1Exists = !!$w("#betRepeater1");
            repeater2Exists = !!$w("#betRepeater2");
        } catch (e) {
            console.log('Error checking repeater existence:', e.message);
        }
        
        // If repeaters exist, try to update their data
        if (repeater1Exists) {
            try {
                console.log('Found betRepeater1, attempting to update...');
                
                // Filter data for first repeater (player1 and player2)
                const repeater1Data = golfPicksData.items.map(item => ({
                    _id: item._id,
                    name: item.name,
                    player1: item.player1,
                    player2: item.player2,
                    winnings1: item.winnings1 || 0,
                    winnings2: item.winnings2 || 0
                }));
                
                // Try different methods to update the repeater
                if (typeof $w("#betRepeater1").data === 'object' && $w("#betRepeater1").data !== null) {
                    // If repeater has a data property that can be set
                    console.log('Setting betRepeater1 data directly');
                    $w("#betRepeater1").data = repeater1Data;
                } else if (typeof $w("#betRepeater1").setData === 'function') {
                    // If repeater has setData method
                    console.log('Using setData method on betRepeater1');
                    $w("#betRepeater1").setData(repeater1Data);
                } else {
                    // Display each item's total for debugging
                    console.log('Could not directly update betRepeater1 data');
                    repeater1Data.forEach(item => {
                        const total = (item.winnings1 || 0) + (item.winnings2 || 0);
                        console.log(`${item.name}: $${formatNumber_AsDollar(total)}`);
                    });
                }
                
                // Set up item ready handler again
                setupRepeater1();
            } catch (err) {
                console.error('Error updating betRepeater1:', err);
            }
        }
        
        if (repeater2Exists) {
            try {
                console.log('Found betRepeater2, attempting to update...');
                
                // Filter data for second repeater (player3 and player4)
                const repeater2Data = golfPicksData.items.map(item => ({
                    _id: item._id,
                    name: item.name,
                    player3: item.player3,
                    player4: item.player4,
                    winnings3: item.winnings3 || 0,
                    winnings4: item.winnings4 || 0
                }));
                
                // Try different methods to update the repeater
                if (typeof $w("#betRepeater2").data === 'object' && $w("#betRepeater2").data !== null) {
                    // If repeater has a data property that can be set
                    console.log('Setting betRepeater2 data directly');
                    $w("#betRepeater2").data = repeater2Data;
                } else if (typeof $w("#betRepeater2").setData === 'function') {
                    // If repeater has setData method
                    console.log('Using setData method on betRepeater2');
                    $w("#betRepeater2").setData(repeater2Data);
                } else {
                    // Display each item's total for debugging
                    console.log('Could not directly update betRepeater2 data');
                    repeater2Data.forEach(item => {
                        const total = (item.winnings3 || 0) + (item.winnings4 || 0);
                        console.log(`${item.name}: $${formatNumber_AsDollar(total)}`);
                    });
                }
                
                // Set up item ready handler again
                setupRepeater2();
            } catch (err) {
                console.error('Error updating betRepeater2:', err);
            }
        }
        
        // If data is updated but repeaters can't be refreshed
        if ((repeater1Exists || repeater2Exists) && golfPicksData.items.length > 0) {
            console.log('Data updated in database.');
            console.log('Current winnings in database:');
            golfPicksData.items.forEach(item => {
                const bet1Total = (item.winnings1 || 0) + (item.winnings2 || 0);
                const bet2Total = (item.winnings3 || 0) + (item.winnings4 || 0);
                console.log(`${item.name}: Bet1=$${formatNumber_AsDollar(bet1Total)}, Bet2=$${formatNumber_AsDollar(bet2Total)}`);
            });
            
            // Try to notify user
            try {
                if ($w("#updateMessage")) {
                    $w("#updateMessage").text = "Data updated. Please refresh page to see latest winnings.";
                    $w("#updateMessage").show();
                }
            } catch (err) {
                // Ignore if element doesn't exist
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error refreshing repeater data:', error);
        return false;
    }
}

// Setup for first repeater
function setupRepeater1() {
    try {
        if ($w("#betRepeater1")) {
            $w("#betRepeater1").onItemReady(($item, itemData, index) => {
                const value1 = Number(itemData.winnings1) || 0;
                const value2 = Number(itemData.winnings2) || 0;
                const total = value1 + value2;
                
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                
                if ($item("#bet1TotalText")) {
                    $item("#bet1TotalText").text = formattedWinnings;
                }
            });
        }
    } catch (error) {
        console.error('Error setting up betRepeater1:', error);
    }
}

// Setup for second repeater
function setupRepeater2() {
    try {
        if ($w("#betRepeater2")) {
            $w("#betRepeater2").onItemReady(($item, itemData, index) => {
                const value3 = Number(itemData.winnings3) || 0;
                const value4 = Number(itemData.winnings4) || 0;
                const total = value3 + value4;
                
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                
                if ($item("#bet2TotalText")) {
                    $item("#bet2TotalText").text = formattedWinnings;
                }
            });
        }
    } catch (error) {
        console.error('Error setting up betRepeater2:', error);
    }
}

// Setup both repeaters
function setupRepeaters() {
    setupRepeater1();
    setupRepeater2();
    console.log('Repeaters successfully configured');
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
                            // After updating the database, try to directly refresh the repeaters
                            await refreshRepeaterData();
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