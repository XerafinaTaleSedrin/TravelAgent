const fs = require('fs-extra');
const path = require('path');
const PDFDocument = require('pdfkit');
const { logger } = require('./utils/logger');
const { LocationTracker } = require('./location-tracker');
const { ActivityScraper } = require('./scraper');

class ReportGenerator {
  constructor() {
    this.outputDir = process.env.REPORT_OUTPUT_DIR || path.join(__dirname, '..', 'data', 'reports');
    this.locationTracker = new LocationTracker();
    this.scraper = new ActivityScraper();
    
    // Ensure output directory exists
    fs.ensureDirSync(this.outputDir);
  }

  async generateDailyReport() {
    try {
      logger.info('Starting daily activity report generation');
      
      // Get current location context
      const locationContext = await this.locationTracker.getLocationContext();
      if (!locationContext || !locationContext.isActive) {
        logger.warn('No active location found, skipping report generation');
        return null;
      }

      // Scrape activities
      const activities = await this.scraper.scrapeAllSources(locationContext);
      
      // Filter and rank activities
      const rankedActivities = this.rankActivities(activities, locationContext);
      
      // Generate report
      const report = {
        generatedAt: new Date().toISOString(),
        location: locationContext,
        totalActivitiesFound: activities.length,
        recommendedActivities: rankedActivities.slice(0, 15), // Top 15
        allActivities: rankedActivities,
        sources: [...new Set(activities.map(a => a.source))],
        summary: this.generateSummary(rankedActivities, locationContext)
      };
      
      // Save to file
      const filename = `daily-report-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(this.outputDir, filename);
      await fs.writeJSON(filepath, report, { spaces: 2 });
      
      // Generate readable text report
      const textReport = this.generateTextReport(report);
      const textFilename = `daily-report-${new Date().toISOString().split('T')[0]}.md`;
      const textFilepath = path.join(this.outputDir, textFilename);
      await fs.writeFile(textFilepath, textReport);

      // Generate PDF report
      const pdfFilename = `daily-report-${new Date().toISOString().split('T')[0]}.pdf`;
      const pdfFilepath = path.join(this.outputDir, pdfFilename);
      await this.generatePdfReport(report, pdfFilepath);
      
      logger.info('Daily report generated successfully', { 
        filepath,
        activitiesCount: rankedActivities.length 
      });
      
      return report;
      
    } catch (error) {
      logger.error('Error generating daily report', { error: error.message });
      throw error;
    }
  }

  rankActivities(activities, locationContext) {
    return activities
      .map(activity => ({
        ...activity,
        score: this.calculateActivityScore(activity, locationContext)
      }))
      .sort((a, b) => b.score - a.score);
  }

  calculateActivityScore(activity, locationContext) {
    let score = 50; // Base score
    
    // HIGHEST PRIORITY: Today's markets get massive boost
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const activityDay = (activity.date || '').toLowerCase();
    
    if (activityDay === today && this.isMarketOrFestival(activity)) {
      score += 100; // Today's markets get top priority
      
      // Extra boost for major markets like Carcassonne
      if (activity.title && activity.title.toLowerCase().includes('carcassonne')) {
        score += 50;
      }
    }
    
    // HIGH PRIORITY: Other markets and festivals
    if (this.isMarketOrFestival(activity)) {
      score += 40;
    }
    
    // FILTER OUT promotional content - give very low scores
    if (this.isPromotionalContent(activity)) {
      score = 5; // Very low score for promotional content
    }
    
    // Boost cultural activities
    if (this.isCultural(activity)) {
      score += 20;
    }
    
    // Boost outdoor activities if good weather expected
    if (this.isOutdoor(activity)) {
      score += 15;
    }
    
    // Extra boost for group hikes
    if (this.isGroupHike(activity)) {
      score += 30; // User specifically wants group hikes
    }
    
    // Boost activities with ratings
    if (activity.rating) {
      const ratingMatch = activity.rating.match(/(\d+\.?\d*)/);
      if (ratingMatch) {
        const rating = parseFloat(ratingMatch[1]);
        score += Math.min(rating * 10, 30); // Max 30 points for rating
      }
    }
    
    // Boost recent/upcoming events
    if (activity.date && this.isRecentOrUpcoming(activity.date)) {
      score += 25;
    }
    
    // Extra emphasis on immediate neighbors: Montolieu, Saissac, Montreal
    const immediateNeighbors = ['montolieu', 'saissac', 'montreal'];
    const activityLocationLower = (activity.location || '').toLowerCase();
    const isImmediateNeighbor = immediateNeighbors.some(neighbor => 
      activityLocationLower.includes(neighbor)
    );
    
    if (isImmediateNeighbor) {
      score += 50; // Major boost for immediate neighbors
    }
    
    // Boost activities within 50km radius, penalize if far
    if (activity.location) {
      if (this.seemsFarFromLocation(activity.location, locationContext)) {
        score -= 15; // Penalize distant activities
      } else {
        score += 20; // Boost nearby activities (within 50km)
      }
    }
    
    // Boost activities with good descriptions
    if (activity.description && activity.description.length > 50) {
      score += 10;
    }
    
    return score;
  }

  isCultural(activity) {
    const culturalKeywords = ['museum', 'gallery', 'exhibition', 'historic', 'cathedral', 'church', 'castle', 'art', 'culture', 'festival'];
    const text = `${activity.title} ${activity.description || ''}`.toLowerCase();
    return culturalKeywords.some(keyword => text.includes(keyword));
  }

  isMarketOrFestival(activity) {
    const marketFestivalKeywords = [
      // French terms
      'marché', 'marchés', 'marche', 'marches',
      'fête', 'fêtes', 'fete', 'fetes',
      'festival', 'festivals', 'festivité', 'festivités',
      'brocante', 'vide-grenier', 'braderie',
      'marché de noël', 'marché aux puces', 'marché fermier',
      'marché bio', 'marché local', 'marché hebdomadaire',
      'foire', 'foires', 'kermesse', 'carnaval',
      // English terms
      'market', 'markets', 'fair', 'fairs', 'carnival', 
      'celebration', 'food market', 'farmers market', 'christmas market',
      'weekly market', 'local market', 'artisan', 'craft fair'
    ];
    const text = `${activity.title} ${activity.description || ''} ${activity.type || ''}`.toLowerCase();
    return marketFestivalKeywords.some(keyword => text.includes(keyword)) || 
           activity.type === 'markets' || activity.type === 'festivals';
  }

  isPromotionalContent(activity) {
    const promotionalKeywords = [
      'survey', 'opinion counts', 'poll', 'questionnaire',
      'discover occitanie by train', 'rail tour', 'welcome to the south',
      'which universe do you prefer', 'vacation in the south of france',
      'climb aboard', 'rail tour invites you', 'promotional', 'advertisement'
    ];
    const text = `${activity.title} ${activity.description || ''}`.toLowerCase();
    return promotionalKeywords.some(keyword => text.includes(keyword));
  }

  isOutdoor(activity) {
    const outdoorKeywords = [
      'hike', 'park', 'garden', 'walk', 'outdoor', 'nature', 'trail', 'mountain', 'lake',
      // French hiking/walking terms
      'marche', 'marches', 'randonnée', 'randonnee', 'balade', 'promenade', 
      'sentier', 'montagne', 'forêt', 'foret', 'groupe', 'populaire'
    ];
    const text = `${activity.title} ${activity.description || ''} ${activity.source || ''}`.toLowerCase();
    return outdoorKeywords.some(keyword => text.includes(keyword));
  }

  isGroupHike(activity) {
    const groupHikeKeywords = [
      'marche populaire', 'marches populaires', 'randonnée groupe', 'randonnee groupe',
      'group hike', 'group walk', 'groupe', 'populaire'
    ];
    const text = `${activity.title} ${activity.description || ''} ${activity.source || ''}`.toLowerCase();
    return groupHikeKeywords.some(keyword => text.includes(keyword)) || 
           (activity.source && activity.source.includes('Marché Populaire'));
  }

  isRecentOrUpcoming(dateStr) {
    try {
      const activityDate = new Date(dateStr);
      const now = new Date();
      const diffDays = (activityDate - now) / (1000 * 60 * 60 * 24);
      return diffDays >= -1 && diffDays <= 30; // Within last day or next 30 days
    } catch {
      return false;
    }
  }

  seemsFarFromLocation(activityLocation, locationContext) {
    const currentCity = locationContext.city.toLowerCase();
    const currentRegion = locationContext.region.toLowerCase();
    const locationText = activityLocation.toLowerCase();
    
    // List of villages/towns within 50km of Montreal, Occitanie
    const nearbyLocations = [
      'montreal', 'bram', 'la force', 'carcassonne', 'trèbes', 'trebes',
      'caunes-minervois', 'rieux-minervois', 'alzonne', 'montolieu', 
      'laure-minervois', 'douzens', 'comigne', 'la redorte', 'redorte',
      'azille', 'moussoulens', 'lespinassiere', 'rieux-en-val', 
      'montlaur', 'val de dagne', 'limoux', 'quillan', 'chalabre',
      'fanjeaux', 'mirepoix', 'castelnaudary', 'port-la-nouvelle',
      'narbonne', 'leucate', 'gruissan', 'sigean', 'coursan'
    ];
    
    // Check if activity location contains any nearby location
    const isNearby = nearbyLocations.some(location => 
      locationText.includes(location)
    );
    
    // Return true if it seems far (not nearby and not in current region)
    return !isNearby && !locationText.includes(currentRegion);
  }

  organizeActivitiesByDay(activities) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    const byDay = {};
    const todayActivities = [];
    
    activities.forEach(activity => {
      // Check if activity title or description mentions a day of the week
      const text = `${activity.title} ${activity.description || ''}`.toLowerCase();
      
      days.forEach(day => {
        if (text.includes(day)) {
          if (!byDay[day]) byDay[day] = [];
          byDay[day].push(activity);
          
          // If it's today, add to special array
          if (day === today) {
            todayActivities.push({...activity, isToday: true});
          }
        }
      });
    });
    
    return { byDay, todayActivities, today };
  }

  generateSummary(activities, locationContext) {
    const { byDay, todayActivities, today } = this.organizeActivitiesByDay(activities);
    
    const categories = {
      cultural: activities.filter(a => this.isCultural(a)).length,
      outdoor: activities.filter(a => this.isOutdoor(a)).length,
      groupHikes: activities.filter(a => this.isGroupHike(a)).length,
      events: activities.filter(a => a.date).length,
      rated: activities.filter(a => a.rating).length,
      markets: activities.filter(a => this.isMarketOrFestival(a)).length
    };
    
    return {
      location: `${locationContext.city}, ${locationContext.region}, ${locationContext.country}`,
      daysRemaining: locationContext.daysRemaining,
      totalActivities: activities.length,
      categories,
      topRecommendation: activities.length > 0 ? activities[0].title : null,
      todayActivities,
      today: today.charAt(0).toUpperCase() + today.slice(1),
      weeklySchedule: byDay
    };
  }

  organizeActivitiesByDayFromToday(activities, today) {
    const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const todayIndex = allDays.findIndex(day => day === today.toLowerCase());
    
    // Create ordered days starting with today
    const orderedDays = [
      ...allDays.slice(todayIndex),
      ...allDays.slice(0, todayIndex)
    ];
    
    const activitiesByDay = {};
    
    // Group activities by day
    activities.forEach(activity => {
      const activityDay = (activity.date || '').toLowerCase();
      if (allDays.includes(activityDay)) {
        if (!activitiesByDay[activityDay]) {
          activitiesByDay[activityDay] = [];
        }
        activitiesByDay[activityDay].push(activity);
      } else {
        // Activities without specific days go in "other"
        if (!activitiesByDay.other) {
          activitiesByDay.other = [];
        }
        activitiesByDay.other.push(activity);
      }
    });
    
    // Sort activities within each day by score
    Object.keys(activitiesByDay).forEach(day => {
      activitiesByDay[day].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
    
    return { activitiesByDay, orderedDays };
  }

  generateTextReport(report) {
    const { location, summary, recommendedActivities } = report;
    
    let text = `# Daily Activity Report - ${new Date().toLocaleDateString()}\n\n`;
    text += `📍 **Current Location:** ${summary.location}\n`;
    text += `📅 **Days Remaining:** ${summary.daysRemaining} days\n`;
    text += `🎯 **Activities Found:** ${summary.totalActivities}\n`;
    text += `📆 **Today is:** ${summary.today}\n\n`;
    
    if (summary.topRecommendation) {
      text += `🌟 **Top Recommendation:** ${summary.topRecommendation}\n\n`;
    }
    
    text += `## Activity Breakdown\n`;
    text += `- 🏛️ Cultural: ${summary.categories.cultural}\n`;
    text += `- 🌿 Outdoor: ${summary.categories.outdoor}\n`;
    text += `- 🥾 Group Hikes: ${summary.categories.groupHikes}\n`;
    text += `- 📅 Events: ${summary.categories.events}\n`;
    text += `- 🛍️ Markets: ${summary.categories.markets}\n`;
    text += `- ⭐ Rated: ${summary.categories.rated}\n\n`;
    
    // Organize activities by day starting with today
    const { activitiesByDay, orderedDays } = this.organizeActivitiesByDayFromToday(
      report.allActivities, summary.today
    );
    
    text += `## Activities by Day\n\n`;
    
    orderedDays.forEach(day => {
      if (activitiesByDay[day] && activitiesByDay[day].length > 0) {
        const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
        const isToday = day.toLowerCase() === summary.today.toLowerCase();
        
        text += `### ${isToday ? '🚨 ' : ''}${dayCapitalized}${isToday ? ' (TODAY)' : ''}\n`;
        
        activitiesByDay[day].forEach((activity, index) => {
          text += `${index + 1}. **${activity.title}**`;
          if (activity.time) {
            text += ` (${activity.time})`;
          }
          if (activity.location) {
            text += ` - ${activity.location}`;
          }
          if (activity.description) {
            text += `\n   ${activity.description}`;
          }
          text += `\n`;
        });
        text += `\n`;
      }
    });
    
    // Add other activities without specific days
    if (activitiesByDay.other && activitiesByDay.other.length > 0) {
      text += `### General Activities\n`;
      activitiesByDay.other.forEach((activity, index) => {
        text += `${index + 1}. **${activity.title}**`;
        if (activity.description) {
          text += `\n   ${activity.description}`;
        }
        text += `\n`;
      });
      text += `\n`;
    }
    
    text += `---\n`;
    text += `*Report generated at ${new Date().toLocaleString()}*\n`;
    text += `*Sources: ${report.sources.join(', ')}*\n`;
    
    return text;
  }

  async generatePdfReport(report, filepath) {
    return new Promise((resolve, reject) => {
      try {
        const { location, summary, recommendedActivities } = report;

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Create write stream
        const stream = fs.createWriteStream(filepath);
        doc.pipe(stream);

        // Title and header
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text('Daily Activity Report', { align: 'center' })
           .moveDown();

        doc.fontSize(16)
           .font('Helvetica')
           .text(new Date().toLocaleDateString(), { align: 'center' })
           .moveDown(2);

        // Location info box
        doc.rect(50, doc.y, 495, 100)
           .stroke();

        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`📍 Current Location: ${summary.location}`, 60, doc.y + 10)
           .font('Helvetica')
           .text(`📅 Days Remaining: ${summary.daysRemaining} days`, 60, doc.y + 5)
           .text(`🎯 Activities Found: ${summary.totalActivities}`, 60, doc.y + 5)
           .text(`📆 Today is: ${summary.today}`, 60, doc.y + 5);

        if (summary.topRecommendation) {
          doc.font('Helvetica-Bold')
             .text(`🌟 Top Recommendation: ${summary.topRecommendation}`, 60, doc.y + 10);
        }

        doc.y += 30;
        doc.moveDown();

        // Activity breakdown
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Activity Breakdown', 50)
           .moveDown(0.5);

        doc.fontSize(10)
           .font('Helvetica')
           .text(`🏛️ Cultural: ${summary.categories.cultural}`, 60)
           .text(`🌿 Outdoor: ${summary.categories.outdoor}`, 60)
           .text(`🥾 Group Hikes: ${summary.categories.groupHikes}`, 60)
           .text(`📅 Events: ${summary.categories.events}`, 60)
           .text(`🛍️ Markets: ${summary.categories.markets}`, 60)
           .text(`⭐ Rated: ${summary.categories.rated}`, 60)
           .moveDown();

        // Activities by day
        const { activitiesByDay, orderedDays } = this.organizeActivitiesByDayFromToday(
          report.allActivities, summary.today
        );

        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text('Activities by Day', 50)
           .moveDown(0.5);

        orderedDays.forEach(day => {
          if (activitiesByDay[day] && activitiesByDay[day].length > 0) {
            const dayCapitalized = day.charAt(0).toUpperCase() + day.slice(1);
            const isToday = day.toLowerCase() === summary.today.toLowerCase();

            // Check if we need a new page
            if (doc.y > 700) {
              doc.addPage();
            }

            doc.fontSize(12)
               .font('Helvetica-Bold')
               .text(`${isToday ? '🚨 ' : ''}${dayCapitalized}${isToday ? ' (TODAY)' : ''}`, 50)
               .moveDown(0.3);

            activitiesByDay[day].slice(0, 8).forEach((activity, index) => {
              // Check if we need a new page for this activity
              if (doc.y > 720) {
                doc.addPage();
              }

              doc.fontSize(10)
                 .font('Helvetica-Bold')
                 .text(`${index + 1}. ${activity.title}`, 60);

              if (activity.time) {
                doc.font('Helvetica')
                   .text(` (${activity.time})`, { continued: true });
              }

              if (activity.location) {
                doc.font('Helvetica')
                   .text(` - ${activity.location}`, 60);
              } else {
                doc.text('', 60); // New line
              }

              if (activity.description) {
                const description = activity.description.length > 150 ?
                  activity.description.substring(0, 150) + '...' :
                  activity.description;
                doc.fontSize(9)
                   .font('Helvetica')
                   .text(`   ${description}`, 60, doc.y, { width: 480 });
              }

              doc.moveDown(0.2);
            });

            doc.moveDown(0.5);
          }
        });

        // Add other activities without specific days
        if (activitiesByDay.other && activitiesByDay.other.length > 0) {
          if (doc.y > 650) {
            doc.addPage();
          }

          doc.fontSize(12)
             .font('Helvetica-Bold')
             .text('General Activities', 50)
             .moveDown(0.3);

          activitiesByDay.other.slice(0, 10).forEach((activity, index) => {
            if (doc.y > 720) {
              doc.addPage();
            }

            doc.fontSize(10)
               .font('Helvetica-Bold')
               .text(`${index + 1}. ${activity.title}`, 60);

            if (activity.description) {
              const description = activity.description.length > 150 ?
                activity.description.substring(0, 150) + '...' :
                activity.description;
              doc.fontSize(9)
                 .font('Helvetica')
                 .text(`   ${description}`, 60, doc.y, { width: 480 });
            }

            doc.moveDown(0.2);
          });
        }

        // Footer - add to current page only
        doc.fontSize(8)
           .font('Helvetica')
           .text(`Generated at ${new Date().toLocaleString()}`, 50, 750, { width: 495, align: 'center' })
           .text(`Sources: ${report.sources.join(', ')}`, 50, 760, { width: 495, align: 'center' });

        // Finalize the PDF
        doc.end();

        stream.on('finish', () => {
          logger.info('PDF report generated successfully', { filepath });
          resolve();
        });

        stream.on('error', (err) => {
          logger.error('Error writing PDF report', { error: err.message });
          reject(err);
        });

      } catch (error) {
        logger.error('Error generating PDF report', { error: error.message });
        reject(error);
      }
    });
  }

  async getLatestReport() {
    const files = await fs.readdir(this.outputDir);
    const reportFiles = files.filter(f => f.startsWith('daily-report-') && f.endsWith('.json'));
    
    if (reportFiles.length === 0) {
      return null;
    }
    
    reportFiles.sort().reverse(); // Most recent first
    const latestFile = path.join(this.outputDir, reportFiles[0]);
    
    return await fs.readJSON(latestFile);
  }
}

module.exports = { ReportGenerator };