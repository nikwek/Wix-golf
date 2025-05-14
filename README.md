# Golf Tournament Application: Technical Documentation

## Overview
This application provides a real-time golf tournament game platform where participants select golfers, and the application tracks their performance in live tournaments, calculating potential winnings based on current standings.

## System Architecture

The application consists of front-end and back-end JavaScript components that interact with Wix collections and an external golf data API (RapidAPI).

### Data Collections

The system uses four main Wix collections:

1. **Golf Leaderboard**: Stores tournament leaderboard data
   - Fields: Rank, Player ID, Name, Country, SCORE, TODAY, THROUGH, R1, R2, R3, R4, TOT

2. **Golf Picks**: Stores participant selections and calculated winnings
   - Fields: Name, Player 1, Player 2, Player 3, Player 4, Winnings 1, Winnings 2, Winnings 3, Winnings 4

3. **Golf Tournament Data**: Stores tournament configuration
   - Fields: Name, Tournament ID, Start Date, End Date, Start Time, End Time

4. **Golf Winnings**: Maps tournament ranks to prize money
   - Fields: Rank, Winnings

### Application Flow

1. **Tournament Time Check**
   The application checks if the current date and time falls within the tournament's configured dates and active hours. This prevents unnecessary API calls outside tournament hours.

   ```javascript
   async function isWithinTournamentDates(tournament) {
       // Date & time comparison logic to determine if tournament is active
   }
   ```

2. **External Data Retrieval**
   When the tournament is active, the application fetches current leaderboard data from the RapidAPI golf data service. A rate limiter ensures the application stays within the API's free tier limits.

   ```javascript
   export const fetchLeaderboardData = async (tournament) => {
       // Fetch data from RapidAPI with rate limiting
   }
   ```

3. **Data Processing**
   The application processes and transforms the raw API data into a structured format, handling special cases like players who have been cut, not started, or finished their rounds.

   ```javascript
   async function transformLeaderboardData(leaderboardData) {
       // Transform raw data into structured format
   }
   ```

4. **Player Filtering**
   The system filters the leaderboard to only include players that participants have selected, using name matching with special character normalization.

   ```javascript
   async function filterLeaderboard(leaderboard) {
       // Filter leaderboard to only include relevant players
   }
   ```

5. **Winnings Calculation**
   For each player in the filtered leaderboard, the system calculates potential winnings based on their current rank and the corresponding prize money in the Golf Winnings collection.

   ```javascript
   export async function updatePlayerWinnings(filteredLeaderboard) {
       // Calculate and update winnings for each participant
   }
   ```

6. **Display Update**
   The application configures repeaters to display participant data with formatted winnings totals.

   ```javascript
   function setupRepeaters() {
       // Configure repeaters to display participant data and winnings
   }
   ```

## Technical Features

### Time Zone Handling
The application works with the user's local time zone. Dates and times stored in Wix collections are automatically converted to the local time zone when retrieved.

### Rate Limiting
To prevent excessive API usage, the application implements a token bucket rate limiter, allowing only 4 requests per hour (matching the RapidAPI free tier limit).

```javascript
const limiter = new RateLimiter({ tokensPerInterval: 4, interval: "hour" });
```

### Parallel Game Support
The application supports two parallel games, allowing each participant to select up to four players (two for each game). Winnings are calculated and displayed separately for each game.

### Special Character Handling
The player name matching algorithm normalizes special characters to ensure players with accented names are correctly matched.

```javascript
const normalizedName = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
```

### Currency Formatting
Winnings are consistently formatted as USD currency values with appropriate formatting.

```javascript
function formatNumber_AsDollar(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
```

## Implementation Notes

1. The system is designed to minimize API calls by only making requests during tournament hours
2. Error handling is implemented throughout to ensure the application continues to function even if some operations fail
3. Extensive logging provides visibility into the application's operation for debugging
4. The application handles various player statuses (active, cut, not started) appropriately
5. Data is cached in Wix collections to reduce API dependency and improve performance

This architecture allows for a low-maintenance, cost-effective tournament game system that automatically updates as tournament standings change, providing participants with real-time updates on their potential winnings.