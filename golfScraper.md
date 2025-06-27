# Golf Shenanigans on Wix

The bash script `leaderboard.sh` does the following:
* Gets golf leaderboard data from ESPN using `golfscraper.js` 
* Posts the data to wix with `wixPoster.py`

The wix site uses `espn-frontend.js` and `espn-backend.js` to process the data and feed it into repeaters / tables.

Cron setup
`*/5 * * * * /home/nik/espn-scraper/leaderboard.sh >> /home/nik/espn-scraper/leaderboard_update.log 2>&1`

Check logs with `tail -f /home/nik/espn-scraper/leaderboard_update.log`

# Install Golf Leaderboard Scraper

Here's how you can get your golf_leaderboard_scraper script running on your Raspberry Pi (using Raspberry Pi 2 version B with 32 bit OS):

## Install Node Version Manager (nvm):
nvm is still the best way to manage Node.js versions. Open your terminal on the new Raspberry Pi and run:

```curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash```

(You might want to check the nvm GitHub page for the very latest v number to replace v0.39.7).
After the installation, close and reopen your terminal or run source ~/.bashrc (if you are using bash) to load nvm.

## Install a supported Node.js LTS version:
Node.js 20 is the current LTS version and should be fully compatible with the latest Raspberry Pi OS (64-bit).

```
nvm install 20
nvm use 20
nvm alias default 20
```
Verify the installation: node -v and npm -v.

## Create your project directory and save the script:

```
mkdir espn-scraper
cd espn-scraper
# Paste your golfScraper.js content into a new file, e.g., using nano:
nano golfScraper.js
```
(Paste the code from the immersive below, then save and exit nano: Ctrl+O, Enter, Ctrl+X)

## Install Puppeteer and Cheerio:

```npm install puppeteer```

This will install Puppeteer and its compatible Chromium browser.

```npm install cheerio```

## Install Chromium on Raspberry Pi:
Even though Puppeteer downloads a browser, it's often more stable to use the system's own Chromium on a Raspberry Pi.

```
sudo apt update
sudo apt install chromium-browser
```

## Run the script:

```node golfScraper.js```

## How it works

Dynamically Read Headers: 
It first inspects the <th> (table header) elements to understand which columns are actually present on the page.

Map to Desired Format: 
It then intelligently maps the found columns to your preferred output format: 
['POS', 'PLAYER', 'SCORE', 'R1', 'R2', 'R3', 'R4', 'TOT'].

If a "TEE TIME" column is found, its data will be mapped to the "R1" column in your output.
The "EARNINGS" column will be ignored if present.
Columns like "POS", "SCORE", "R2", "R3", "R4", and "TOT" will output an empty string ('') if they are not present on the page (e.g., before the tournament starts).