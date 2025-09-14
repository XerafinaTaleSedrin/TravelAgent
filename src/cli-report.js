#!/usr/bin/env node

require('dotenv').config();
const { ReportGenerator } = require('./report-generator');
const { logger } = require('./utils/logger');

async function main() {
  try {
    const generator = new ReportGenerator();
    console.log('Generating daily activity report...');
    
    const report = await generator.generateDailyReport();
    
    if (report) {
      console.log('\n✅ Daily report generated successfully!');
      console.log(`📍 Location: ${report.summary.location}`);
      console.log(`📅 Days remaining: ${report.summary.daysRemaining}`);
      console.log(`🎯 Activities found: ${report.summary.totalActivities}`);
      console.log(`🌟 Top recommendation: ${report.summary.topRecommendation || 'None'}`);
      console.log(`\nReport saved to data/reports/`);
    } else {
      console.log('⚠️ No active location found - report not generated');
    }
  } catch (error) {
    logger.error('Failed to generate report', { error: error.message });
    console.error('❌ Failed to generate report:', error.message);
    process.exit(1);
  }
}

main();