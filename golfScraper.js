// golfScraper.js

// Import the Puppeteer library.
// If you don't have it installed, run: npm install puppeteer
const puppeteer = require('puppeteer');
// Import cheerio for parsing HTML and extracting data
// If you don't have it installed, run: npm install cheerio
const cheerio = require('cheerio');
// Import Node.js file system module for writing to a file
const fs = require('fs');

async function scrapeGolfLeaderboard() {
    let browser;
    try {
        console.log('Launching browser...');
        // 1. Launch a new headless browser instance.
        // For Raspberry Pi, it's crucial to specify the executablePath
        // to use the system's ARM-compatible Chromium browser.
        // Also, add --no-sandbox and --disable-setuid-sandbox for Linux environments.
        browser = await puppeteer.launch({
            headless: true, // Use 'true' for older Raspbian versions or if 'new' causes issues.
            executablePath: '/usr/bin/chromium-browser', // Common path for Chromium on Raspberry Pi OS
            args: [
                '--no-sandbox', // Required for running as root or in certain environments
                '--disable-setuid-sandbox' // Often needed alongside --no-sandbox
            ]
        });
        
        console.log('Opening a new page...');
        // 2. Open a new page in the browser.
        const page = await browser.newPage();

        // Set a default timeout for all page operations
        page.setDefaultTimeout(120000); // Keep overall timeout at 120 seconds for robustness

        // 3. Navigate to the ESPN golf leaderboard URL.
        // The default 'load' event will be used, which fires when the page and its initial resources are loaded.
        console.log('Navigating to ESPN golf leaderboard...');
        // Using the tournament-specific URL, but the code is now more adaptable to various leaderboard states
        await page.goto('https://www.espn.com/golf/leaderboard/_/tournamentId/401703516');
        
        console.log('Page navigated. Waiting for 15 seconds for content to load...');
        // Increased fixed wait period to give more time for JavaScript to render content.
        await new Promise(r => setTimeout(r, 15000)); // Wait 15 seconds

        console.log('Fixed wait complete. Waiting for leaderboard table to be present...');
        // Increased timeout for the specific leaderboard table div to appear.
        // This ensures the element is in the DOM before we try to extract from it.
        await page.waitForSelector('.Table__ScrollerWrapper.relative.overflow-hidden', { timeout: 30000 }); // Wait up to 30 seconds for the element

        console.log('Leaderboard table found. Extracting data...');
        // 4. Extract the innerHTML of the target div.
        const leaderboardHtml = await page.$eval(
            '.Table__ScrollerWrapper.relative.overflow-hidden',
            (element) => element.innerHTML
        );

        // 5. Parse the HTML using Cheerio and convert to TSV.
        const $ = cheerio.load(leaderboardHtml);
        const rows = $('.Table__TBODY .PlayerRow__Overview'); // Select all player rows

        // Define the desired output headers for the TSV, regardless of what's on the page
        const desiredOutputHeaders = ['POS', 'PLAYER', 'SCORE', 'R1', 'R2', 'R3', 'R4', 'TOT'];
        let tsvData = [desiredOutputHeaders.join('\t')]; // Initialize TSV with desired headers

        // Dynamically extract actual headers from the HTML table
        const actualHtmlHeaders = [];
        $('.Table__THEAD .Table__TH').each((i, el) => {
            const text = $(el).text().trim();
            // Only add non-empty headers (skips the caret column if present)
            if (text) {
                actualHtmlHeaders.push(text);
            }
        });

        // Create a map from actual header text to its column index in the HTML table
        const headerIndexMap = {};
        actualHtmlHeaders.forEach((headerText, index) => {
            // Map 'TEE TIME' to 'R1' for output
            if (headerText === 'TEE TIME') {
                headerIndexMap['R1'] = index;
            } else {
                // Store the index for other headers as they appear
                headerIndexMap[headerText] = index;
            }
        });

        rows.each((i, row) => {
            // Select all <td> elements within the current row
            const columns = $(row).find('td'); 
            let rowOutputData = [];

            // Determine if the first column is the caret icon.
            // If the first <td> contains the caret SVG, then actual data starts from index 1.
            let initialColumnOffset = 0;
            if ($(columns[0]).find('svg.PlayerRow__caret__down').length > 0) {
                initialColumnOffset = 1;
            }

            // Iterate through the desired output headers to build the row's data
            desiredOutputHeaders.forEach(desiredHeader => {
                let value = ''; // Default value if the column is not found or empty

                // Get the HTML column index from our map, accounting for the initial offset
                const htmlColumnRelativeIndex = headerIndexMap[desiredHeader];
                const htmlColumnAbsoluteIndex = initialColumnOffset + htmlColumnRelativeIndex;

                // Check if the column exists in the current row's data
                if (htmlColumnRelativeIndex !== undefined && htmlColumnAbsoluteIndex < columns.length) {
                    const columnElement = $(columns[htmlColumnAbsoluteIndex]);
                    
                    // Special handling for the PLAYER name, which is inside an anchor tag
                    if (desiredHeader === 'PLAYER') {
                        value = columnElement.find('.leaderboard_player_name').text().trim();
                    } else {
                        value = columnElement.text().trim();
                    }
                }
                rowOutputData.push(value);
            });
            tsvData.push(rowOutputData.join('\t')); 
        });

        const finalTsvOutput = tsvData.join('\n'); 

        // 6. Write the TSV data to a file.
        const fileName = 'leaderboard.tsv';
        fs.writeFileSync(fileName, finalTsvOutput);
        console.log(`TSV data successfully written to ${fileName}`);

    } catch (error) {
        console.error('An error occurred:', error);
        if (error.message.includes('Failed to launch the browser process')) {
            console.error('This often indicates an issue with the Chromium executable path or necessary dependencies.');
            console.error('Ensure Chromium is installed on your Raspberry Pi: `sudo apt install chromium-browser`');
            console.error('Also, check if the executablePath in the script is correct for your system.');
        } else if (error.message.includes('Waiting for selector')) {
            console.error('The table selector was not found within the given timeout.');
            console.error('This might mean the page took longer to load, or the selector has changed.');
            console.error('Consider increasing the fixed wait time or the waitForSelector timeout, or verifying the selector.');
        }
    } finally {
        // 7. Close the browser instance.
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
    }
}

// Call the function to start the scraping.
scrapeGolfLeaderboard();
