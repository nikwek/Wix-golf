import wixData from 'wix-data';
import { fetchAndCacheLeaderboard } from 'backend/back-end';

// Fetch the tournament data from the collection
async function tournamentData() {
    const tournamentData = await wixData.query('tournamentData').find();
    console.log('Tournament Data:', tournamentData.items);
    return tournamentData.items;
}

// Function to update the bets table with formatted data
async function updateBetsTable() {
    try {
        // Check if the table exists
        if (!$w("#betsTable")) {
            console.error("Element #betsTable not found");
            return;
        }
        
        // Make table visible
        $w("#betsTable").show();
        
        // Setup column definitions first
        $w("#betsTable").columns = [
            {
                "id": "sponsor",
                "label": "Sponsor", 
                "width": 150,
                "dataPath": "sponsor",
                "type": "string"
            },
            {
                "id": "bet1_players",
                "label": "Bet 1 Players",
                "width": 180,
                "dataPath": "bet1_players",
                "type": "string"
            },
            {
                "id": "bet1", 
                "label": "Amount",
                "width": 100,
                "dataPath": "bet1",
                "type": "string"
            },
            {
                "id": "bet2_players",
                "label": "Bet 2 Players",
                "width": 180,
                "dataPath": "bet2_players", 
                "type": "string"
            },
            {
                "id": "bet2", 
                "label": "Amount",
                "width": 100,
                "dataPath": "bet2",
                "type": "string"
            }
        ];
        
        // Format currency for display
        const USDollar = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        });
        
        // Fetch data from BetStatus collection
        const betQueryResult = await wixData.query("BetStatus").find();
        console.log("Raw BetStatus data:", betQueryResult.items);
        
        // Skip everything if no data
        if (betQueryResult.items.length === 0) {
            console.error("No data found in BetStatus collection");
            return;
        }
        
        // Create rows for the table
        const tableRows = await Promise.all(betQueryResult.items.map(async item => {
            // Fetch golf picks for this sponsor
            const pickResult = await wixData.query("GolfPicks")
                .eq("name", item.sponsor)
                .find();
            
            const pick = pickResult.items.length > 0 ? pickResult.items[0] : null;
            
            // Try option 1: Using horizontal format with forward slash
            return {
                sponsor: String(item.sponsor || ""),
                bet1_players: pick ? 
                    `${pick.player1 || ""} / ${pick.player2 || ""}` : "",
                bet1: String(USDollar.format(Number(item.projected_amount_bet1) || 0)),
                bet2_players: pick ? 
                    `${pick.player3 || ""} / ${pick.player4 || ""}` : "",
                bet2: String(USDollar.format(Number(item.projected_amount_bet2) || 0))
            };
        }));
        
        console.log("Setting table rows:", tableRows);
        
        // Set the data rows directly
        $w("#betsTable").rows = tableRows;
    } catch (error) {
        console.error("Error updating bets table:", error.message, error.stack);
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

    console.log('Current Date:', now);
    console.log('Tournament Start Date:', startDate);
    console.log('Tournament End Date:', endDate);
    console.log('Current Time in Seconds:', nowTime);
    console.log('Tournament Start Time in Seconds:', startSeconds);
    console.log('Tournament End Time in Seconds:', endSeconds);

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
    console.log('Transforming leaderboard data...');
    return leaderboardData.map(player => {
        const rounds = player.rounds || [];
        return {
            rank: player.position || 'N/A',
            player_id: player.player_id,
            name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
            country: player.country || 'N/A',
            totalScore: player.total_to_par || 'N/A',
            scoreToday: player.strokes || 'N/A',
            totalThrough: player.holes_played || 'N/A',
            R1: rounds.find(round => round.round_number === 1)?.strokes || 'N/A',
            R2: rounds.find(round => round.round_number === 2)?.strokes || 'N/A',
            R3: rounds.find(round => round.round_number === 3)?.strokes || 'N/A',
            R4: rounds.find(round => round.round_number === 4)?.strokes || 'N/A',
            totalStrokes: player.strokes || 'N/A'
        };
    });
}

// Function to filter the leaderboard based on the player names
async function filterLeaderboard(leaderboard) {
    const playerNames = await fetchPlayerNames();
    console.log('Player Names:', playerNames);
    const playerNamesSet = new Set(playerNames);

    const filtered = leaderboard.filter(player => {
        const fullName = `${player.first_name} ${player.last_name}`;
        return playerNamesSet.has(fullName);
    });

    console.log('Filtered Leaderboard:', filtered);
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
            R1: player.R1,
            R2: player.R2,
            R3: player.R3,
            R4: player.R4,
            totalStrokes: player.totalStrokes
        };

        console.log('Saving Player Data:', playerData);

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

// Function to calculate bet status for all sponsors
async function calculateBetStatus(filteredLeaderboard) {
    console.log('Calculating bet status...');
    
    // Fetch golf winnings data
    const golfWinningsData = await wixData.query("GolfWinnings").find();
    const winningsMap = new Map();
    
    // Create a map of rank to winnings
    if (golfWinningsData.items.length > 0) {
        golfWinningsData.items.forEach(item => {
            winningsMap.set(item.rank, Number(item.winnings) || 0);
        });
    }
    
    // Create a map of player_id to winnings based on their rank
    const playerWinnings = new Map();
    filteredLeaderboard.forEach(player => {
        const winnings = winningsMap.get(player.rank) || 0;
        playerWinnings.set(player.player_id, Number(winnings));
    });
    
    // Fetch golf picks data
    const golfPicksData = await wixData.query("GolfPicks").find();
    const betStatus = [];
    
    // Calculate bet status for each sponsor
    if (golfPicksData.items.length > 0) {
        for (const pick of golfPicksData.items) {
            // Find players in the leaderboard
            const player1 = filteredLeaderboard.find(p => p.name === pick.player1);
            const player2 = filteredLeaderboard.find(p => p.name === pick.player2);
            const player3 = filteredLeaderboard.find(p => p.name === pick.player3);
            const player4 = filteredLeaderboard.find(p => p.name === pick.player4);
            
            // Calculate winnings for bet 1 (player1 + player2)
            let bet1Winnings = 0;
            if (player1) bet1Winnings += Number(playerWinnings.get(player1.player_id) || 0);
            if (player2) bet1Winnings += Number(playerWinnings.get(player2.player_id) || 0);
            
            // Calculate winnings for bet 2 (player3 + player4)
            let bet2Winnings = 0;
            if (player3) bet2Winnings += Number(playerWinnings.get(player3.player_id) || 0);
            if (player4) bet2Winnings += Number(playerWinnings.get(player4.player_id) || 0);
            
            betStatus.push({
                sponsor: pick.name,
                projected_amount_bet1: Number(bet1Winnings),
                projected_amount_bet2: Number(bet2Winnings)
            });
        }
    }
    
    return betStatus;
}

async function updateBetStatus(betStatus) {
    console.log('Updating bet status...');
    
    for (const status of betStatus) {
        try {
            const existingSponsor = await wixData.query("BetStatus")
                .eq("sponsor", status.sponsor)
                .find();
                
            if (existingSponsor.items.length > 0) {
                const sponsorId = existingSponsor.items[0]._id;
                await wixData.update("BetStatus", {
                    _id: sponsorId,
                    sponsor: status.sponsor,
                    projected_amount_bet1: Number(status.projected_amount_bet1),
                    projected_amount_bet2: Number(status.projected_amount_bet2)
                });
            } else {
                await wixData.insert("BetStatus", {
                    sponsor: status.sponsor,
                    projected_amount_bet1: Number(status.projected_amount_bet1),
                    projected_amount_bet2: Number(status.projected_amount_bet2)
                });
            }
        } catch (error) {
            console.error(`Error updating bet status for ${status.sponsor}:`, error);
        }
    }
}

$w.onReady(async function () {
    try {
        // First update the bets table
        await updateBetsTable();
        
        // Then handle the tournament data and leaderboard updates
        const tournament = await tournamentData();
        if (await isWithinTournamentDates(tournament[0])) {
            try {
                const leaderboard = await fetchAndCacheLeaderboard(tournament[0]);
                if (leaderboard) {
                    // Process leaderboard data
                    const filteredLeaderboard = await filterLeaderboard(leaderboard);
                    const transformedLeaderboard = await transformLeaderboardData(filteredLeaderboard);
                    await saveToLeaderboard(transformedLeaderboard);
                    
                    // Update bet status
                    const betStatus = await calculateBetStatus(transformedLeaderboard);
                    await updateBetStatus(betStatus);
                    
                    // Refresh the table data after updating bet status
                    await updateBetsTable(); 
                    
                    console.log('Leaderboard data and bet status saved successfully.');
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