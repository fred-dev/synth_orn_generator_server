// Example usage of the refactored services
import { weatherService } from "../services/weatherService.js";
import { pythonService } from "../services/pythonService.js";
import { logger } from "../utils/logger.js";
import { validateCoordinates } from "../utils/validators.js";

// Example: Get weather data
async function getWeatherExample() {
  try {
    const coords = validateCoordinates(-33.8688, 151.2093); // Sydney
    const weatherData = await weatherService.getHistoricalWeather(
      coords.lat, 
      coords.lon, 
      Math.floor(Date.now() / 1000) - 86400 // Yesterday
    );
    logger.info("Weather data retrieved:", weatherData);
  } catch (error) {
    logger.error("Error getting weather:", error.message);
  }
}

// Example: Check if coordinates are in Australia
async function checkAustraliaExample() {
  try {
    const coords = validateCoordinates(-33.8688, 151.2093); // Sydney
    const result = await pythonService.checkIsInAustralia(coords.lat, coords.lon);
    logger.info("Australia check result:", result);
  } catch (error) {
    logger.error("Error checking Australia:", error.message);
  }
}

// Example: Get water distance
async function getWaterDistanceExample() {
  try {
    const coords = validateCoordinates(-33.8688, 151.2093); // Sydney
    const result = await pythonService.getWaterDistance(coords.lat, coords.lon);
    logger.info("Water distance result:", result);
  } catch (error) {
    logger.error("Error getting water distance:", error.message);
  }
}

// Run examples
async function runExamples() {
  logger.info("Running examples...");
  
  await getWeatherExample();
  await checkAustraliaExample();
  await getWaterDistanceExample();
  
  logger.info("Examples completed");
}

// Uncomment to run examples
// runExamples().catch(console.error);


