# Travel Agent

A personal travel agent application that automatically tracks your location and discovers daily activities by scraping various websites. Get personalized activity recommendations delivered daily based on your current location.

## Features

- **Location Tracking**: Manages your current location and travel timeline
- **Multi-Source Web Scraping**: Discovers activities from configurable websites
- **Smart Activity Ranking**: Scores activities based on cultural significance, ratings, proximity, and more
- **Daily Reports**: Generates comprehensive daily activity recommendations
- **Automated Scheduling**: Runs daily at your preferred time
- **Expandable Source List**: Easily add new websites to scrape

## Quick Start

```bash
# Setup the application
npm run setup
npm install

# Configure your location (edit config/locations.json)
# Add websites to scrape (edit config/websites.json)

# Generate your first report
npm run generate-report

# Start the automated service
npm start
```

## Current Location

Currently configured for **Montreal, Occitanie, France** until **October 29, 2024**.

## Available Commands

- `npm start` - Start the travel agent service (runs daily reports automatically)
- `npm run generate-report` - Generate a report immediately
- `npm run dev` - Start in development mode with auto-restart
- `npm run setup` - Initialize directories and configuration files

## CLI Commands

```bash
# Generate report on demand
node src/index.js report

# Check current status
node src/index.js status

# View current location
node src/index.js location
```

## Configuration

### Location Configuration (`config/locations.json`)
Update your current location, coordinates, and travel dates.

### Website Sources (`config/websites.json`)
Add or modify websites to scrape for activities. Each source includes:
- URL and selectors for extracting activity data
- Activity type (attractions, events, restaurants, etc.)
- Active/inactive status

### Environment Variables (`.env`)
- `DAILY_REPORT_TIME` - Time for daily reports (default: 08:00)
- `REQUEST_DELAY` - Delay between website requests (default: 2000ms)
- `LOG_LEVEL` - Logging level (default: info)

## Reports

Daily reports are saved in `data/reports/` in both JSON and Markdown formats:
- Ranked activity recommendations
- Activity breakdown by category
- Location context and days remaining
- Source attribution

## Adding New Websites

1. Edit `config/websites.json`
2. Add new source with URL and CSS selectors
3. Test with `npm run generate-report`
4. Set `active: true` when ready

Example:
```json
{
  "name": "Local Events Site",
  "url": "https://example.com/events",
  "type": "events",
  "selectors": {
    "title": ".event-title",
    "description": ".event-desc",
    "date": ".event-date"
  },
  "active": true
}
```

## Activity Scoring

Activities are ranked based on:
- Cultural significance (+20 points)
- Outdoor activities (+15 points)  
- User ratings (up to +30 points)
- Recent/upcoming events (+25 points)
- Proximity to location
- Description quality (+10 points)

## Logs

Application logs are stored in `logs/` directory:
- `travel-agent.log` - General application logs
- `error.log` - Error logs only