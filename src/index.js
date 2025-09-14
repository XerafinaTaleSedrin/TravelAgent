#!/usr/bin/env node

require('dotenv').config();
const { logger } = require('./utils/logger');
const { TravelAgentScheduler } = require('./scheduler');
const { ReportGenerator } = require('./report-generator');
const { LocationTracker } = require('./location-tracker');

class TravelAgent {
  constructor() {
    this.scheduler = new TravelAgentScheduler();
    this.reportGenerator = new ReportGenerator();
    this.locationTracker = new LocationTracker();
  }

  async start() {
    try {
      logger.info('Starting Travel Agent application');
      
      // Check current location
      const location = await this.locationTracker.getCurrentLocation();
      if (!location) {
        logger.warn('No current location configured');
        return;
      }
      
      logger.info('Travel Agent started', { 
        location: `${location.city}, ${location.region}, ${location.country}`,
        daysRemaining: await this.locationTracker.getDaysRemaining()
      });
      
      // Start scheduler for automated reports
      this.scheduler.start();
      
      // Generate initial report if none exists today
      await this.generateInitialReport();
      
      // Keep the application running
      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());
      
    } catch (error) {
      logger.error('Error starting Travel Agent', { error: error.message });
      process.exit(1);
    }
  }

  async generateInitialReport() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const latestReport = await this.reportGenerator.getLatestReport();
      
      if (!latestReport || !latestReport.generatedAt.startsWith(today)) {
        logger.info('Generating initial daily report');
        await this.reportGenerator.generateDailyReport();
      } else {
        logger.info('Daily report already exists for today');
      }
    } catch (error) {
      logger.error('Error generating initial report', { error: error.message });
    }
  }

  async shutdown() {
    logger.info('Shutting down Travel Agent');
    this.scheduler.stop();
    process.exit(0);
  }

  // CLI Commands
  async runCommand(command, args = []) {
    switch (command) {
      case 'report':
        return await this.scheduler.runDailyReportNow();
      
      case 'status':
        const location = await this.locationTracker.getCurrentLocation();
        const jobStatus = this.scheduler.getJobStatus();
        return {
          location,
          daysRemaining: await this.locationTracker.getDaysRemaining(),
          scheduler: jobStatus
        };
      
      case 'location':
        if (args.length > 0 && args[0] === 'update') {
          // Future: Allow location updates via CLI
          logger.info('Location update via CLI - future feature');
        }
        return await this.locationTracker.getCurrentLocation();
      
      default:
        logger.error('Unknown command', { command });
        return null;
    }
  }
}

// CLI execution
async function main() {
  const agent = new TravelAgent();
  
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command) {
    // Start in daemon mode
    await agent.start();
  } else {
    // Run specific command
    try {
      const result = await agent.runCommand(command, args.slice(1));
      if (result) {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      logger.error('Command execution failed', { command, error: error.message });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  main().catch(error => {
    logger.error('Application failed to start', { error: error.message });
    process.exit(1);
  });
}

module.exports = { TravelAgent };