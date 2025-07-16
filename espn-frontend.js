import wixData from 'wix-data';
import { fetchLeaderboardData, updatePlayerWinnings, updateGolfLeaderboardCollection } from 'backend/espn-backend.jsw';

// Fetch player names from GolfPicks
async function fetchPlayerNames() {
    const results = await wixData.query("GolfPicks").find();
    let playerNames = [];
    if (results.items.length > 0) {
        results.items.forEach((item) => {
            if (item.player1) playerNames.push(item.player1);
            if (item.player2) playerNames.push(item.player2);
            if (item.player3) playerNames.push(item.player3);
            if (item.player4) playerNames.push(item.player4);
        });
    }
    return playerNames;
}

// Filter leaderboard to only include picked players
async function filterLeaderboard(leaderboard) {
    const playerNames = await fetchPlayerNames();
    const playerNamesSet = new Set(playerNames.map(n => n.trim().toLowerCase()));
    return leaderboard.filter(player => playerNamesSet.has(player.player.trim().toLowerCase()));
}

// Format number as dollar amount with commas
function formatNumber_AsDollar(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function setupRepeater1() {
    try {
        if ($w("#betRepeater1")) {
            $w("#betRepeater1").onItemReady(($item, itemData) => {
                const value1 = Number(itemData.winnings1) || 0;
                const value2 = Number(itemData.winnings2) || 0;
                const total = value1 + value2;
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                if ($item("#bet1TotalText")) {
                    $item("#bet1TotalText").text = formattedWinnings;
                }
            });
        }
    } catch (error) {}
}

function setupRepeater2() {
    try {
        if ($w("#betRepeater2")) {
            $w("#betRepeater2").onItemReady(($item, itemData) => {
                const value3 = Number(itemData.winnings3) || 0;
                const value4 = Number(itemData.winnings4) || 0;
                const total = value3 + value4;
                const formattedWinnings = "$" + formatNumber_AsDollar(total);
                if ($item("#bet2TotalText")) {
                    $item("#bet2TotalText").text = formattedWinnings;
                }
            });
        }
    } catch (error) {}
}

function setupRepeaters() {
    setupRepeater1();
    setupRepeater2();
}

// Query data directly and populate repeaters
async function refreshRepeaterData() {
    try {
        const golfPicksData = await wixData.query("GolfPicks").find();
        if ($w("#betRepeater1")) {
            const repeater1Data = golfPicksData.items.map(item => ({
                _id: item._id,
                name: item.name,
                player1: item.player1,
                player2: item.player2,
                winnings1: item.winnings1 || 0,
                winnings2: item.winnings2 || 0
            }));
            if (typeof $w("#betRepeater1").data === 'object' && $w("#betRepeater1").data !== null) {
                $w("#betRepeater1").data = repeater1Data;
            } else if (typeof $w("#betRepeater1").setData === 'function') {
                $w("#betRepeater1").setData(repeater1Data);
            }
            setupRepeater1();
        }
        if ($w("#betRepeater2")) {
            const repeater2Data = golfPicksData.items.map(item => ({
                _id: item._id,
                name: item.name,
                player3: item.player3,
                player4: item.player4,
                winnings3: item.winnings3 || 0,
                winnings4: item.winnings4 || 0
            }));
            if (typeof $w("#betRepeater2").data === 'object' && $w("#betRepeater2").data !== null) {
                $w("#betRepeater2").data = repeater2Data;
            } else if (typeof $w("#betRepeater2").setData === 'function') {
                $w("#betRepeater2").setData(repeater2Data);
            }
            setupRepeater2();
        }
        return true;
    } catch (error) {
        console.error('Error refreshing repeater data:', error);
        return false;
    }
}

$w.onReady(async function () {
    try {
        // Show/hide betRepeater2 based on GolfPicks player3/player4
        const picksResult = await wixData.query("GolfPicks")
            .isNotEmpty("player3")
            .isNotEmpty("player4")
            .find();
        if (picksResult.items.length > 0) {
            $w("#bet2Section").expand();
        } else {
            $w("#bet2Section").collapse();
        }

        setupRepeaters();
        const leaderboard = await fetchLeaderboardData();
        if (leaderboard) {
            const filteredLeaderboard = await filterLeaderboard(leaderboard);
            // 1. Update GolfLeaderboard collection
            await updateGolfLeaderboardCollection(filteredLeaderboard);
            // 2. Update GolfPicks winnings
            await updatePlayerWinnings(filteredLeaderboard);
            // 3. Refresh UI
            await refreshRepeaterData();
        }

        const leaderboardResult = await wixData.query("Leaderboard").ascending("position").find();
        if ($w("#leaderboardTable")) {
            // Remove duplicates by name (or use _id if available)
            const seen = new Set();
            const uniqueRows = leaderboardResult.items.filter(item => {
                if (seen.has(item.name)) return false;
                seen.add(item.name);
                return true;
            });
            $w("#leaderboardTable").rows = uniqueRows;
        }

    } catch (error) {
        console.error("Error in onReady:", error);
    }
});