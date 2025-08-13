import fetch from "node-fetch";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class WeatherService {
  async getHistoricalWeather(lat, lon, date) {
    try {
      const url = `https://api.openweathermap.org/data/3.0/onecall/timemachine?lat=${lat}&lon=${lon}&dt=${date}&appid=${config.api.openWeather.apiKey}&units=metric`;
      
      logger.debug("Weather request URL:", url);
      
      const response = await fetch(url);
      const data = await response.json();
      
      logger.debug("Weather response complete:", JSON.stringify(data));
      
      return data;
    } catch (error) {
      logger.error("Error fetching weather data:", error);
      throw error;
    }
  }
}

export const weatherService = new WeatherService();


