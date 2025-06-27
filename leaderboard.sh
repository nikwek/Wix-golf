#!/bin/bash
export PATH=$PATH:/usr/local/bin:/usr/bin:/bin
cd /home/nik/espn-scraper
# Run the Node.js scraper
echo "Running golfScraper.js..."
node golfScraper.js

# Check if the previous command succeeded
if [ $? -eq 0 ]; then
  echo "Running wixPoster.py..."
  python3 wixPoster.py
else
  echo "golfScraper.js failed. Skipping wixPoster.py."
  exit 1
fi