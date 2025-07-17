import wixData from 'wix-data';

// Fetch all rows from ESPNLeaderboard collection
export async function fetchLeaderboardData() {
    try {
        const results = await wixData.query("ESPNLeaderboard").limit(1000).find();
        return results.items || [];
    } catch (error) {
        console.error('Error fetching ESPNLeaderboard data:', error);
        throw error;
    }
}

// Map ESPNLeaderboard fields to Golf Leaderboard (Leaderboard) fields
function mapToGolfLeaderboard(espnRow) {
    return {
        rank: espnRow.pos,
        position: normalizeRank(espnRow.pos),
        // player_id: (ignore)
        name: espnRow.player,
        // country: (ignore)
        totalScore: espnRow.score,
        scoreToday: espnRow.today,
        totalThrough: espnRow.thru,
        r1: espnRow.r1,
        r2: espnRow.r2,
        r3: espnRow.r3,
        r4: espnRow.r4,
        totalStrokes: espnRow.tot,
        // status: (ignore)
    };
}

// Update GolfLeaderboard collection with filtered leaderboard
export async function updateGolfLeaderboardCollection(filteredLeaderboard) {
    try {
        // Remove all existing items
        const existing = await wixData.query("Leaderboard").limit(1000).find();
        if (existing.items.length > 0) {
            const idsToRemove = existing.items.map(item => item._id);
            await wixData.bulkRemove("Leaderboard", idsToRemove);
        }
        // Map and insert new filtered leaderboard
        if (filteredLeaderboard.length > 0) {
            const mappedLeaderboard = filteredLeaderboard.map(mapToGolfLeaderboard);
            await wixData.bulkInsert("Leaderboard", mappedLeaderboard);
        }
        return { success: true };
    } catch (error) {
        console.error('Error updating Leaderboard collection:', error);
        return { success: false, error: error.toString() };
    }
}

// Utility: Normalize rank (e.g., "T1" -> 1, "2" -> 2)
function normalizeRank(pos) {
    if (!pos) return 100; // treat missing as "bottom"
    const match = pos.match(/\d+/);
    return match ? parseInt(match[0], 10) : 100;
}

// Update player winnings in GolfPicks table using ESPNLeaderboard data, handling ties
export async function updatePlayerWinnings(leaderboard) {
    try {
        // Fetch GolfWinnings data
        const golfWinningsData = await wixData.query("GolfWinnings").limit(1000).find();
        const winningsMap = new Map();
        golfWinningsData.items.forEach(item => {
            winningsMap.set(item.rank, item.winnings);
        });

        // Map player names to their pos/rank from leaderboard (normalized)
        const playerNameToPos = new Map();
        leaderboard.forEach(row => {
            playerNameToPos.set((row.player || '').trim().toLowerCase(), row.pos);
        });

        // Log all ESPN leaderboard names
        console.log("ESPN Leaderboard playerNameToPos keys:", Array.from(playerNameToPos.keys()));

        // Build a map: normalizedRank -> [players]
        const rankToPlayers = {};
        leaderboard.forEach(row => {
            const rank = normalizeRank(row.pos);
            if (rank) {
                if (!rankToPlayers[rank]) rankToPlayers[rank] = [];
                rankToPlayers[rank].push(row.player);
            }
        });

        // For each rank, calculate the average winnings for ties
        const rankToAvgWinnings = {};
        const uniqueRanks = Object.keys(rankToPlayers).map(Number).sort((a, b) => a - b);
        let i = 0;
        while (i < uniqueRanks.length) {
            const rank = uniqueRanks[i];
            const tiedPlayers = rankToPlayers[rank];
            const numTied = tiedPlayers.length;
            let totalWinnings = 0;
            for (let j = 0; j < numTied; j++) {
                totalWinnings += winningsMap.get(rank + j) || 0;
            }
            const avgWinnings = numTied ? Math.round(totalWinnings / numTied) : 0;
            for (let j = 0; j < numTied; j++) {
                rankToAvgWinnings[rank + j] = avgWinnings;
            }
            i += numTied;
        }

        // Log the winnings map and average winnings
        console.log("winningsMap:", Array.from(winningsMap.entries()));
        console.log("rankToAvgWinnings:", rankToAvgWinnings);

        // Fetch all picks
        const golfPicksData = await wixData.query("GolfPicks").limit(1000).find();

        // Update each pick with winnings, logging details
        for (const pick of golfPicksData.items) {
            // Normalize names for lookup
            const norm1 = (pick.player1 || '').trim().toLowerCase();
            const norm2 = (pick.player2 || '').trim().toLowerCase();
            const norm3 = pick.player3 ? (pick.player3 || '').trim().toLowerCase() : null;
            const norm4 = pick.player4 ? (pick.player4 || '').trim().toLowerCase() : null;

            // Lookup rank
            const rank1 = normalizeRank(playerNameToPos.get(norm1));
            const rank2 = normalizeRank(playerNameToPos.get(norm2));
            const rank3 = norm3 ? normalizeRank(playerNameToPos.get(norm3)) : null;
            const rank4 = norm4 ? normalizeRank(playerNameToPos.get(norm4)) : null;

            // Lookup winnings with fallback
            const winnings1 = rank1 ? (rankToAvgWinnings[rank1] !== undefined ? rankToAvgWinnings[rank1] : winningsMap.get(rank1) || 0) : 0;
            const winnings2 = rank2 ? (rankToAvgWinnings[rank2] !== undefined ? rankToAvgWinnings[rank2] : winningsMap.get(rank2) || 0) : 0;
            const winnings3 = rank3 ? (rankToAvgWinnings[rank3] !== undefined ? rankToAvgWinnings[rank3] : winningsMap.get(rank3) || 0) : 0;
            const winnings4 = rank4 ? (rankToAvgWinnings[rank4] !== undefined ? rankToAvgWinnings[rank4] : winningsMap.get(rank4) || 0) : 0;

            // Log the pick and winnings
            console.log(`Pick: ${pick.name}`);
            console.log(`  player1: "${pick.player1}" -> "${norm1}", rank1: ${rank1}, winnings1: ${winnings1}`);
            console.log(`  player2: "${pick.player2}" -> "${norm2}", rank2: ${rank2}, winnings2: ${winnings2}`);
            if (pick.player3) console.log(`  player3: "${pick.player3}" -> "${norm3}", rank3: ${rank3}, winnings3: ${winnings3}`);
            if (pick.player4) console.log(`  player4: "${pick.player4}" -> "${norm4}", rank4: ${rank4}, winnings4: ${winnings4}`);

            const updatedPick = {
                ...pick,
                winnings1,
                winnings2,
                winnings3,
                winnings4
            };

            try {
                await wixData.update("GolfPicks", updatedPick);
            } catch (updateError) {
                console.error(`Error updating pick for ${pick.name}:`, updateError);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Exception in updatePlayerWinnings:', error);
        return { success: false, error: error.toString() };
    }
}