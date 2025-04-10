import wixData from 'wix-data';
import { fetchAndCacheLeaderboard } from 'backend/back-end';

// Fetch the tournament data from the collection
async function tournamentData() {
    const tournamentData = await wixData.query('tournamentData').find();
    console.log('Tournament Data:', tournamentData.items); // Debugging: Log the tournament data
    return tournamentData.items;
}

async function setupBetRepeater() {
    let USDollar = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumSignificantDigits: 4,
    });
    $w("#betRepeater").onItemReady(($item, itemData) => {
        $item("#sponsor").text = itemData.sponsor;
        $item("#projectedAmount").text = `${USDollar.format(itemData.projected_amount)}`;
    });
}

async function populateBetTable() {
    const betQueryResult = await wixData.query("BetStatus").find();
    const bets = betQueryResult.items;
    $w('#betRepeater').data = bets;
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
                    if (item.player1) {
                        playerNames.push(item.player1);
                    }
                    if (item.player2) {
                        playerNames.push(item.player2);
                    }
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
    console.log('Player Names:', playerNames); // Debugging: Log the player names
    const playerNamesSet = new Set(playerNames);

    const filtered = leaderboard.filter(player => {
        const fullName = `${player.first_name} ${player.last_name}`;
        return playerNamesSet.has(fullName);
    });

    console.log('Filtered Leaderboard:', filtered); // Debugging: Log the filtered leaderboard
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

        console.log('Saving Player Data:', playerData); // Debugging: Log the player data being saved

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

$w.onReady(async function () {
    const tournament = await tournamentData();
    if (await isWithinTournamentDates(tournament[0])) {
        try {
            const leaderboard = await fetchAndCacheLeaderboard(tournament[0]);
            if (leaderboard) {
                // First filter the raw data
                const filteredLeaderboard = await filterLeaderboard(leaderboard);
                // Then transform only the filtered data
                const transformedLeaderboard = await transformLeaderboardData(filteredLeaderboard);
                // Save the transformed data
                await saveToLeaderboard(transformedLeaderboard);
                console.log('Leaderboard data saved successfully.');
            } else {
                console.log('No updates to the leaderboard.');
            }
        } catch (error) {
            console.error('Error running application:', error);
        }
    } else {
        console.log('Tournament is not active.');
    }

    setupBetRepeater();
    populateBetTable();
});