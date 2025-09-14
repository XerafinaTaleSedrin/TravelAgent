const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils/logger');
const { getAllMarkets } = require('./market-data');

class ActivityScraper {
  constructor() {
    this.websitesFile = path.join(__dirname, '..', 'config', 'websites.json');
    this.userAgent = process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";
    this.requestDelay = parseInt(process.env.REQUEST_DELAY) || 2000;
    this.maxRetries = parseInt(process.env.MAX_RETRIES) || 3;
  }

  async getWebsiteConfigs() {
    try {
      const config = await fs.readJSON(this.websitesFile);
      return config.sources.filter(source => source.active);
    } catch (error) {
      logger.error('Error loading website configurations', { error: error.message });
      throw error;
    }
  }

  async scrapeWebsite(websiteConfig, locationContext) {
    const activities = [];
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        logger.info(`Scraping ${websiteConfig.name} (attempt ${attempt})`);
        
        // Customize URL based on location if needed
        const url = this.customizeUrlForLocation(websiteConfig.url, locationContext);
        
        const response = await axios.get(url, {
          headers: {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
          },
          timeout: 30000
        });

        const $ = cheerio.load(response.data);
        
        // Extract activities based on selectors
        const extractedActivities = this.extractActivities($, websiteConfig);
        
        activities.push(...extractedActivities.map(activity => ({
          ...activity,
          source: websiteConfig.name,
          type: websiteConfig.type,
          scrapedAt: new Date().toISOString(),
          url: url
        })));
        
        logger.info(`Successfully scraped ${extractedActivities.length} activities from ${websiteConfig.name}`);
        break; // Success, exit retry loop
        
      } catch (error) {
        logger.error(`Error scraping ${websiteConfig.name} (attempt ${attempt})`, { 
          error: error.message,
          url: websiteConfig.url 
        });
        
        if (attempt === this.maxRetries) {
          logger.error(`Failed to scrape ${websiteConfig.name} after ${this.maxRetries} attempts`);
        } else {
          // Wait before retry
          await this.delay(this.requestDelay * attempt);
        }
      }
    }
    
    // Delay between websites to be respectful
    await this.delay(this.requestDelay);
    
    return activities;
  }

  extractActivities($, websiteConfig) {
    const activities = [];
    const selectors = websiteConfig.selectors;
    
    // Try to find activity containers (common parent elements)
    const containers = this.findActivityContainers($, selectors);
    
    containers.each((index, element) => {
      try {
        const activity = {};
        
        // Extract title
        if (selectors.title) {
          activity.title = $(element).find(selectors.title).first().text().trim();
        }
        
        // Extract description
        if (selectors.description) {
          activity.description = $(element).find(selectors.description).first().text().trim();
        }
        
        // Extract rating
        if (selectors.rating) {
          activity.rating = $(element).find(selectors.rating).first().text().trim();
        }
        
        // Extract date if available
        if (selectors.date) {
          activity.date = $(element).find(selectors.date).first().text().trim();
        }
        
        // Extract location if available
        if (selectors.location) {
          activity.location = $(element).find(selectors.location).first().text().trim();
        }
        
        // Extract link if available
        const linkElement = $(element).find('a').first();
        if (linkElement.length > 0) {
          activity.link = linkElement.attr('href');
        }
        
        // Only add if we have at least a title and filter out irrelevant content
        if (activity.title && activity.title.length > 3 && this.isRelevantActivity(activity)) {
          activities.push(activity);
        }
      } catch (error) {
        logger.warn('Error extracting individual activity', { error: error.message });
      }
    });
    
    return activities;
  }

  findActivityContainers($, selectors) {
    // Try different strategies to find activity containers
    const strategies = [
      () => $(selectors.title).closest('div, article, li, section'),
      () => $(selectors.title).parent(),
      () => $(selectors.title)
    ];
    
    for (const strategy of strategies) {
      try {
        const containers = strategy();
        if (containers.length > 0) {
          return containers;
        }
      } catch (error) {
        continue;
      }
    }
    
    return $();
  }

  customizeUrlForLocation(baseUrl, locationContext) {
    // For now, return base URL as-is
    // Future enhancement: modify URLs based on location
    return baseUrl;
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async scrapeAllSources(locationContext) {
    const websiteConfigs = await this.getWebsiteConfigs();
    const allActivities = [];
    
    logger.info(`Starting scrape of ${websiteConfigs.length} sources for ${locationContext.city}`);
    
    for (const config of websiteConfigs) {
      try {
        const activities = await this.scrapeWebsite(config, locationContext);
        allActivities.push(...activities);
      } catch (error) {
        logger.error(`Failed to scrape ${config.name}`, { error: error.message });
      }
    }
    
    // Add static market data for comprehensive market coverage
    const marketData = getAllMarkets();
    allActivities.push(...marketData);
    logger.info(`Added ${marketData.length} static market entries`);
    
    // Remove duplicates based on title similarity
    const uniqueActivities = this.removeDuplicates(allActivities);
    
    logger.info(`Scraped ${uniqueActivities.length} unique activities total`);
    
    return uniqueActivities;
  }

  isRelevantActivity(activity) {
    const title = activity.title.toLowerCase();
    const description = (activity.description || '').toLowerCase();
    
    // Filter out social media and navigation elements
    const irrelevantKeywords = [
      'partager', 'share', 'facebook', 'twitter', 'whatsapp', 'instagram', 
      'pinterest', 'youtube', 'tiktok', 'follow us', 'ce contenu',
      'go to content', 'newsletter', 'subscribe', 'sign up',
      'cookies', 'privacy', 'terms', 'contact us', 'about us'
    ];
    
    // Check if title contains irrelevant keywords
    if (irrelevantKeywords.some(keyword => title.includes(keyword))) {
      return false;
    }
    
    // Filter out very short titles that are likely navigation
    if (title.length < 5) {
      return false;
    }
    
    // Filter out links that are just hash anchors or modals
    if (activity.link && (activity.link.startsWith('#') || activity.link.includes('modal'))) {
      return false;
    }
    
    return true;
  }

  removeDuplicates(activities) {
    const seen = new Set();
    return activities.filter(activity => {
      const key = activity.title.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = { ActivityScraper };