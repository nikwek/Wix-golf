#!/bin/bash
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin
cd /home/nik/espn-scraper

# Log the current date and time
echo "===== Run started at $(date) ====="

# Run the Node.js scraper
echo "Running golfScraper.js..."
/home/nik/.nvm/versions/node/v20.19.3/bin/node golfScraper.js

# Check if the previous command succeeded
if [ $? -eq 0 ]; then
  echo "Running wixPoster.py..."
  python3 wixPoster.py
else
  echo "golfScraper.js failed. Skipping wixPoster.py."
  exit 1
fi