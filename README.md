# Golf Shenanigans on Wix

The bash script `leaderboard.sh` does the following:
* Gets golf leaderboard data from ESPN using `golfscraper.js` 
* Posts the data to wix with `wixPoster.py`

The wix site uses `espn-frontend.js` and `espn-backend.js` to process the data and feed it into repeaters / tables.

## Tournament setup
Edit `config.json` on the Raspberry Pi and save the tournament URL.
Edit Golf Tournament Data collection in Wix to capture the tournament name. 

## Cron setup
`*/5 * * * * /home/<username>/<directory>/leaderboard.sh >> /home/<username>/<directory>/leaderboard_update.log 2>&1`

Check logs with `tail -f /home/<username>/<directory>/leaderboard_update.log`

# Installation

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

1.  **Create a New Directory for the Project**
    Open your terminal or command prompt and create a new directory for your project. You can name it `wix-golf` or anything else you prefer.

    ```bash
    mkdir wix-golf
    ```

2.  **Navigate into the Project Directory**
    Change your current directory to the newly created `wix-golf` folder.

    ```bash
    cd wix-golf
    ```

3.  **Clone the GitHub Repository**
    Now that you are inside the `wix-golf` directory, clone the project files from the GitHub repository. This will download all the code into your current directory.

    ```bash
    git clone [https://github.com/nikwek/Wix-golf.git](https://github.com/nikwek/Wix-golf.git) .
    ```
    * The `.` (dot) at the end of the `git clone` command is important. It tells Git to clone the contents of the repository directly into the current directory (`wix-golf`), rather than creating a nested `Wix-golf` folder inside it.

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

## Run the shell script:
... frome within the directory you created:
```./leaderboard.sh```

