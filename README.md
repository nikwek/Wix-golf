# Wix-golf

This is javascript code for a Wix page to calculate the winner of a golf game. 

Each participant picks two Players (golfers). They are stored in the Golf Picks table. The app checks rapidapi.com’s golf-leaderboard data based on the setup information in the Golf Tournament Data collection. To minimize API calls, and to avoid having to pay for API calls, RapidAPI is only called between the Start Date and the End Date, and within that date limit, between Start Time and End Time.

After each participant picks players and the tournament has started, the code calls RapidAPI and gets all the information to fill the Golf Leaderboard collection. Based on the rank, the code calculates the projected earnings for each golfer and stores it in the Golf Picks collection for each participant, both of the players’ projected earnings that each Sponsor picked (from the Golf Picks collection) are added. The participant who has the highest earnings at the end, wins. 

We started with just having participants pick two players. This version expands it to have two parallel games with a total of 4 players each. 

Wix Collections:
```
Golf Leaderboard: Rank | Player ID | Name | Country | SCORE | TODAY | THROUGH | R1 | R2 | R3 | R4 | TOT
Golf Picks: Name | Player 1 | Player 2 | Player 3 | Player 4 | Winnings 1 | Winnings 2 | Winnings 3 | Winnings 4
Golf Tournament Data: Name | Tournament ID | Start Date | End Date | Start Time | End Time
Golf Winnings: Rank | Winnings
```
