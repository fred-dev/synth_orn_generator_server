import { Client } from "@gradio/client";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class GradioService {
  constructor() {
    this.app = null;
  }

  async initialize() {
    try {
      this.app = await Client.connect(config.gradio.spacePath, {
        hf_token: config.api.huggingFace.token,
        space_status: (status) => logger.debug("Space status:", JSON.stringify(status)),
      });
      
      await this.app.view_api();
      return this.app;
    } catch (error) {
      logger.error("Failed to initialize Gradio:", error);
      throw error;
    }
  }

  async generateAudio(params) {
    try {
      if (!this.app) {
        await this.initialize();
      }

      logger.debug("Generating with Gradio");

      const submission = this.app.submit("/generate", {
        seconds_start: 0,
        seconds_total: 23,
        latitude: params.lat,
        longitude: params.lon,
        temperature: params.temp,
        humidity: params.humidity,
        wind_speed: params.wind_speed,
        pressure: params.pressure,
        minutes_of_day: params.minutes_of_day,
        day_of_year: params.day_of_year,
        cfg_scale: 4.0,
        steps: 120,
        preview_every: 0,
        seed: -1,
        sampler_type: "dpmpp-2m-sde",
        sigma_min: 0.03,
        sigma_max: 50,
        cfg_rescale: 0.25,
        use_init: -1,
      });

      for await (const message of submission) {
        if (message.type === "data") {
          logger.debug("Data received:", JSON.stringify(message.data, null, 2));
          if (message.data && message.data[0] && message.data[0].url) {
            return message.data[0].url;
          } else {
            throw new Error("Invalid data format or missing URL in the response.");
          }
        }

        if (message.type === "status") {
          logger.debug("Status update:", JSON.stringify(message));
        }
      }
    } catch (error) {
      logger.error("Error occurred during Gradio generation:", error);
      throw error;
    }
  }
}

export const gradioService = new GradioService();

