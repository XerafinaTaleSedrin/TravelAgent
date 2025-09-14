#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function setup() {
  console.log('Setting up Travel Agent...\n');
  
  // Create necessary directories
  const directories = [
    'data/reports',
    'logs',
    'data/cache'
  ];
  
  for (const dir of directories) {
    const dirPath = path.join(__dirname, '..', dir);
    await fs.ensureDir(dirPath);
    console.log(`✅ Created directory: ${dir}`);
  }
  
  // Create .env file if it doesn't exist
  const envPath = path.join(__dirname, '..', '.env');
  const envExamplePath = path.join(__dirname, '..', '.env.example');
  
  if (!await fs.pathExists(envPath)) {
    if (await fs.pathExists(envExamplePath)) {
      await fs.copy(envExamplePath, envPath);
      console.log('✅ Created .env file from .env.example');
    } else {
      const defaultEnv = `NODE_ENV=development
LOG_LEVEL=info
DAILY_REPORT_TIME=08:00
USER_AGENT="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
REQUEST_DELAY=2000
MAX_RETRIES=3
`;
      await fs.writeFile(envPath, defaultEnv);
      console.log('✅ Created default .env file');
    }
  } else {
    console.log('ℹ️  .env file already exists');
  }
  
  console.log('\n🎉 Setup complete!');
  console.log('\nNext steps:');
  console.log('1. Install dependencies: npm install');
  console.log('2. Update your location in config/locations.json');
  console.log('3. Add websites to scrape in config/websites.json');
  console.log('4. Run the application: npm start');
  console.log('5. Generate a report manually: npm run generate-report');
}

setup().catch(console.error);