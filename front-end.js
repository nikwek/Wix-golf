import wixData from 'wix-data';
import { fetchLeaderboardData } from 'backend/rapidapi';

// fetch the tournament data from the collection
async function tournamentData() {
    const tournamentData = await wixData.query('tournamentData').find();
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
    })
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

    console.log('Debugging Information:');
    console.log(`Now: ${now}`);
    console.log(`Start Date: ${startDate}`);
    console.log(`End Date: ${endDate}`);
    console.log(`Current Time in Seconds: ${nowTime}`);
    console.log(`Start Time in Seconds: ${startSeconds}`);
    console.log(`End Time in Seconds: ${endSeconds}`);

    // Check if current date is within the tournament dates
    if (now >= startDate && now <= endDate) {
        // Check if current time is within the tournament times for each day
        if (nowTime >= startSeconds && nowTime <= endSeconds) {
            console.log('Tournament is currently active');
            return true;
        }
    }

    console.log('Tournament is NOT active right now.');
    return false;
}

// Function to format the leaderboard data
async function transformLeaderboardData(leaderboardData) {
    console.log('transforming leaderboard data...');
    return leaderboardData.map(player => {
        const currentRound = player.rounds.find(round => round.round_number === player.current_round);
        return {
            rank: player.position,
            player_id: player.player_id,
            name: `${player.first_name} ${player.last_name}`,
            country: player.country,
            totalScore: player.status === 'cut' ? 'cut' : player.total_to_par,
            scoreToday: player.status === 'cut' ? '' : currentRound ? currentRound.total_to_par : '',
            totalThrough: player.holes_played,
            R1: player.rounds.find(round => round.round_number === 1)?.strokes || '',
            R2: player.rounds.find(round => round.round_number === 2)?.strokes || '',
            R3: player.rounds.find(round => round.round_number === 3)?.strokes || '',
            R4: player.rounds.find(round => round.round_number === 4)?.strokes || '',
            totalStrokes: player.strokes
        };
    });
}

// Function to filter the leaderboard based on the player names
async function filterLeaderboard(leaderboard) {
    console.log('filtering leaderboard...');
    const playerNames = await fetchPlayerNames();
    console.log(playerNames);
    //console.log(leaderboard);
    //const filteredLeaderboard = leaderboard.filter(entry => playerNames.includes(entry.name));
    //console.log(filteredLeaderboard);
    const playerNamesSet = new Set(playerNames);

    const filteredLeaderboard = leaderboard.filter(player => {
        const fullName = `${player.first_name} ${player.last_name}`;
        return playerNamesSet.has(fullName);
    });

    console.log(filteredLeaderboard);
    return filteredLeaderboard;
}

// Function to map and save the data to the 'Leaderboard' collection
//export const saveToLeaderboard = async (filteredLeaderboardTable) => {
async function saveToLeaderboard(filteredLeaderboardTable) {
    console.log('saving to leaderboard...');
    for (const player of filteredLeaderboardTable) {
        const playerData = {
            rank: player.position,
            player_id: player.player_id,
            name: `${player.first_name} ${player.last_name}`,
            country: player.country,
            totalScore: player.total_to_par,
            scoreToday: player.strokes,
            totalThrough: player.holes_played,
            r1: player.rounds[0]?.strokes || 0,
            r2: player.rounds[1]?.strokes || 0,
            r3: player.rounds[2]?.strokes || 0,
            r4: player.rounds[3]?.strokes || 0,
            totalStrokes: player.strokes
        };

        try {
        // Check if the player already exists in the collection
        const existingPlayer = await wixData.query("Leaderboard")
            .eq("player_id", player.player_id)
            .find();

        if (existingPlayer.items.length > 0) {
            // Update the existing player data
            const playerId = existingPlayer.items[0]._id;
            await wixData.update("Leaderboard", {
            _id: playerId,
            ...playerData
            });
        } else {
            // Insert new player data
            await wixData.insert("Leaderboard", playerData);
        }

        } catch (error) {
        console.error(`Error updating player data for ${player.first_name} ${player.last_name}:`, error);
        }
    }
}

// Function to fetch player names from the "GolfPicks" collection
async function fetchPlayerNames() {
    console.log('fetching player names...');
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

// Fetch GolfWinnings data
async function fetchGolfWinningsData() {
    console.log('fetching golf winnings data...');
    const golfWinnings = await wixData.query('GolfWinnings').find();
    return golfWinnings.items;
}

// Fetch GolfPicks data
async function fetchGolfPicksData() {
    console.log('fetching golf picks data...');
    const golfPicks = await wixData.query('GolfPicks').find();
    return golfPicks.items;
}

// Calculate winnings for each rank, considering ties
async function calculateWinnings(leaderboard, golfWinnings) {
    console.log('calculating winnings...');
    const calculatedWinnings = [];
    const ranks = [...new Set(leaderboard.map(player => player.rank))];

    ranks.forEach(rank => {
        const tiedPlayers = leaderboard.filter(player => player.rank === rank);
        const totalWinnings = tiedPlayers.reduce((sum, player) => {
            const winnings = golfWinnings.find(w => w.rank === rank)?.winnings || 0;
            return sum + winnings;
        }, 0);
        calculatedWinnings.push({ rank, winnings: totalWinnings / tiedPlayers.length });
    });

    return calculatedWinnings;
}

// Update BetStatus collection
async function calculateBetStatus(friends, leaderboard, winnings) {
    // Create a map of winnings based on rank for easy lookup
    console.log('Calculate bet status...');
    const winningsMap = new Map(winnings.map(w => [w.rank, w.winnings]));

    // Initialize the betStatus array
    const betStatus = [];

    // Iterate over each friend
    for (const friend of friends) {
        let totalWinnings = 0;

        // Iterate over each pick for the current friend
        for (const pick of friend.picks) {
            // Find the player1 winnings
            const player1 = leaderboard.find(p => `${p.first_name} ${p.last_name}` === pick.player1);
            if (player1) {
                totalWinnings += winningsMap.get(player1.position) || 0;
            }

            // Find the player2 winnings
            const player2 = leaderboard.find(p => `${p.first_name} ${p.last_name}` === pick.player2);
            if (player2) {
                totalWinnings += winningsMap.get(player2.position) || 0;
            }
        }

        // Add the friend's name and total winnings to betStatus
        betStatus.push({
            sponsor: friend.name,
            projected_amount: totalWinnings
        });
    }

    console.log('Bet Status:', betStatus);
    return betStatus;
}

async function updateBetStatus(betStatus) {
    console.log('Updating BetStatus collection...');

    for (const entry of betStatus) {
        try {
            // Check if an entry for the sponsor already exists
            const existingEntry = await wixData.query('BetStatus')
                .eq('sponsor', entry.sponsor)
                .find();

            if (existingEntry.items.length > 0) {
                // Update the existing entry
                const entryId = existingEntry.items[0]._id;
                await wixData.update('BetStatus', {
                    _id: entryId,
                    ...entry
                });
                console.log(`Updated BetStatus for sponsor: ${entry.sponsor}`);
            } else {
                // Insert a new entry
                await wixData.insert('BetStatus', entry);
                console.log(`Inserted BetStatus for sponsor: ${entry.sponsor}`);
            }
        } catch (error) {
            console.error(`Error updating BetStatus for sponsor: ${entry.sponsor}`, error);
        }
    }
}


$w.onReady(async function () {
    // Only query the RapidAPI when the tournament is on. Update start dates and times!
    const tournament = await tournamentData();
    console.log('Tournament Data recieived');
    console.log(tournament[0]);
    if (await isWithinTournamentDates(tournament[0])) {
        try {
            console.log('...running the program...')
            // Call the function to fetch RapidAPI leaderboard data
            const leaderboard = await fetchLeaderboardData(tournament[0]);
            console.log('main prog: got leaderboard data...');
            // Reformat that data so that it has the information I need
            const transformedData = await transformLeaderboardData(leaderboard);
            console.log('main prog: got transformedData...');
            console.log(transformedData);
            // Filter out the players we're not following
            const filteredLeaderboardTable = await filterLeaderboard(leaderboard);
            console.log('main prog: got filteredLeaderbardTable data...');
            console.log(filteredLeaderboardTable);
            // Save to CMS
            await saveToLeaderboard(filteredLeaderboardTable);
            // Calculate the winnings 
            const golfWinnings = await fetchGolfWinningsData();
            console.log('main prog: doing the golfWinnings thing...');
            console.log(golfWinnings);
            const golfPicks = await fetchGolfPicksData();
            console.log('main prog: get the golf picks...');
            console.log(golfPicks);
            const calculatedWinnings = await calculateWinnings(transformedData, golfWinnings);
            console.log('main prog: calculate winnings...');
            console.log(calculatedWinnings);
            const friends = golfPicks.map(pick => ({
                name: pick.name,
                picks: [{ player1: pick.player1, player2: pick.player2 }]
            }));
            console.log('main prog: friends...');
            console.log(friends);
            const betStatus = await calculateBetStatus(friends, filteredLeaderboardTable, calculatedWinnings);
            await updateBetStatus(betStatus);
        } catch (error) {
            console.error('Error running application:', error);
        }
    } else {
        console.log('Current date and time is outside the tournament dates. Application will not run.');
    }
    // update tables on the page
    setupBetRepeater();
    console.log('update bet table...')
    populateBetTable();

});
