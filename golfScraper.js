// golfScraper.js

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));
const tournamentUrl = config.tournamentUrl;

async function scrapeGolfLeaderboard() {
    let browser;
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: true,
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        console.log('Opening a new page...');
        const page = await browser.newPage();
        page.setDefaultTimeout(120000);

        console.log('Navigating to ESPN golf leaderboard...');
        await page.goto(tournamentUrl);

        console.log('Page navigated. Waiting for 15 seconds for content to load...');
        await new Promise(r => setTimeout(r, 15000));

        console.log('Fixed wait complete. Waiting for leaderboard table to be present...');
        await page.waitForSelector('.Table__ScrollerWrapper.relative.overflow-hidden', { timeout: 30000 });

        console.log('Leaderboard table found. Extracting data...');
        const leaderboardHtml = await page.$eval(
            '.Table__ScrollerWrapper.relative.overflow-hidden',
            (element) => element.innerHTML
        );

        const $ = cheerio.load(leaderboardHtml);
        const rows = $('.Table__TBODY .PlayerRow__Overview');

        // Desired output headers
        const desiredOutputHeaders = ['POS', 'PLAYER', 'SCORE', 'TODAY', 'THRU', 'R1', 'R2', 'R3', 'R4', 'TOT'];
        let tsvData = [desiredOutputHeaders.join('\t')];

        // Extract all headers (including empty ones for caret, movement, etc.)
        const allHtmlHeaders = [];
        $('.Table__THEAD .Table__TH').each((i, el) => {
            const text = $(el).text().trim();
            allHtmlHeaders.push(text); // Keep empty headers for correct alignment
        });

        // Map header name (uppercased) to its index
        const headerNameToIndex = {};
        allHtmlHeaders.forEach((header, idx) => {
            if (header) {
                headerNameToIndex[header.toUpperCase()] = idx;
            }
        });

        // Detect if "TEE TIME" is present and "R1" is not (pre-tournament mode)
        const hasTeeTime = headerNameToIndex.hasOwnProperty('TEE TIME');
        const hasR1 = headerNameToIndex.hasOwnProperty('R1');
        const useTeeTimeForR1 = hasTeeTime && !hasR1;

        rows.each((i, row) => {
            const columns = $(row).find('td');
            let rowOutputData = [];
            desiredOutputHeaders.forEach(desiredHeader => {
                let value = '';
                let tdIdx = headerNameToIndex[desiredHeader];

                // If pre-tournament, put TEE TIME in R1
                if (desiredHeader === 'R1' && useTeeTimeForR1) {
                    tdIdx = headerNameToIndex['TEE TIME'];
                }

                if (tdIdx !== undefined && tdIdx < columns.length) {
                    const columnElement = $(columns[tdIdx]);
                    if (desiredHeader === 'PLAYER') {
                        value =
                            columnElement.find('.leaderboard_player_name').text().trim() ||
                            columnElement.find('a, span').first().text().trim() ||
                            columnElement.text().trim();
                    } else {
                        value = columnElement.text().trim();
                    }
                }
                rowOutputData.push(value);
            });
            tsvData.push(rowOutputData.join('\t'));
        });

        const finalTsvOutput = tsvData.join('\n');
        const fileName = 'leaderboard.tsv';
        fs.writeFileSync(fileName, finalTsvOutput);
        console.log(`TSV data successfully written to ${fileName}`);

    } catch (error) {
        console.error('An error occurred:', error);
        if (error.message && error.message.includes('Failed to launch the browser process')) {
            console.error('This often indicates an issue with the Chromium executable path or necessary dependencies.');
            console.error('Ensure Chromium is installed on your Raspberry Pi: `sudo apt install chromium-browser`');
            console.error('Also, check if the executablePath in the script is correct for your system.');
        } else if (error.message && error.message.includes('Waiting for selector')) {
            console.error('The table selector was not found within the given timeout.');
            console.error('This might mean the page took longer to load, or the selector has changed.');
            console.error('Consider increasing the fixed wait time or the waitForSelector timeout, or verifying the selector.');
        }
    } finally {
        if (browser) {
            await browser.close();
            console.log('Browser closed.');
        }
    }
}

scrapeGolfLeaderboard();