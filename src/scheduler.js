const cron = require('node-cron');
const { logger } = require('./utils/logger');
const { ReportGenerator } = require('./report-generator');

class TravelAgentScheduler {
  constructor() {
    this.reportGenerator = new ReportGenerator();
    this.jobs = new Map();
  }

  start() {
    logger.info('Starting Travel Agent Scheduler');
    
    // Daily report at 8:00 AM
    const dailyTime = process.env.DAILY_REPORT_TIME || '8:00';
    const [hour, minute] = dailyTime.split(':');
    
    const dailyJob = cron.schedule(`${minute} ${hour} * * *`, async () => {
      try {
        logger.info('Running scheduled daily report generation');
        await this.reportGenerator.generateDailyReport();
      } catch (error) {
        logger.error('Error in scheduled daily report', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Paris' // Adjust based on current location
    });
    
    this.jobs.set('daily-report', dailyJob);
    dailyJob.start();
    
    logger.info(`Daily report scheduled for ${dailyTime} (Europe/Paris timezone)`);
    
    // Optional: Weekly summary on Sundays at 6 PM
    const weeklyJob = cron.schedule('0 18 * * 0', async () => {
      try {
        logger.info('Running weekly activity summary');
        await this.generateWeeklySummary();
      } catch (error) {
        logger.error('Error in weekly summary', { error: error.message });
      }
    }, {
      scheduled: false,
      timezone: 'Europe/Paris'
    });
    
    this.jobs.set('weekly-summary', weeklyJob);
    weeklyJob.start();
    
    logger.info('Weekly summary scheduled for Sundays at 6 PM');
  }

  stop() {
    logger.info('Stopping Travel Agent Scheduler');
    
    this.jobs.forEach((job, name) => {
      job.stop();
      logger.info(`Stopped job: ${name}`);
    });
    
    this.jobs.clear();
  }

  async runDailyReportNow() {
    try {
      logger.info('Running daily report on demand');
      const report = await this.reportGenerator.generateDailyReport();
      return report;
    } catch (error) {
      logger.error('Error running daily report on demand', { error: error.message });
      throw error;
    }
  }

  async generateWeeklySummary() {
    // Future enhancement: Generate weekly activity summaries
    logger.info('Weekly summary generation - placeholder for future implementation');
  }

  getJobStatus() {
    const status = {};
    this.jobs.forEach((job, name) => {
      status[name] = {
        running: job.running,
        lastDate: job.lastDate,
        nextDate: job.nextDate
      };
    });
    return status;
  }
}

module.exports = { TravelAgentScheduler };