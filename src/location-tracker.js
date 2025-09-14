const fs = require('fs-extra');
const path = require('path');
const { logger } = require('./utils/logger');

class LocationTracker {
  constructor() {
    this.locationsFile = path.join(__dirname, '..', 'config', 'locations.json');
  }

  async getCurrentLocation() {
    try {
      const locations = await fs.readJSON(this.locationsFile);
      const current = locations.current;
      
      // Check if current location is still valid
      const now = new Date();
      const endDate = new Date(current.endDate);
      
      if (now > endDate) {
        logger.warn('Current location period has ended', { location: current });
        return null;
      }
      
      return current;
    } catch (error) {
      logger.error('Error reading current location', { error: error.message });
      throw error;
    }
  }

  async updateLocation(locationData) {
    try {
      const locations = await fs.readJSON(this.locationsFile);
      
      // Move current to past if exists
      if (locations.current) {
        locations.past.push({
          ...locations.current,
          actualEndDate: new Date().toISOString().split('T')[0]
        });
      }
      
      // Set new current location
      locations.current = {
        ...locationData,
        startDate: locationData.startDate || new Date().toISOString().split('T')[0]
      };
      
      await fs.writeJSON(this.locationsFile, locations, { spaces: 2 });
      logger.info('Location updated successfully', { location: locationData });
      
      return locations.current;
    } catch (error) {
      logger.error('Error updating location', { error: error.message });
      throw error;
    }
  }

  async getDaysRemaining() {
    const location = await this.getCurrentLocation();
    if (!location) return 0;
    
    const now = new Date();
    const endDate = new Date(location.endDate);
    const diffTime = endDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async getLocationContext() {
    const location = await this.getCurrentLocation();
    if (!location) return null;
    
    const daysRemaining = await this.getDaysRemaining();
    
    return {
      ...location,
      daysRemaining,
      isActive: daysRemaining > 0,
      searchTerms: [
        location.city,
        `${location.city} ${location.region}`,
        `${location.region} ${location.country}`,
        location.region,
        location.country
      ]
    };
  }
}

module.exports = { LocationTracker };