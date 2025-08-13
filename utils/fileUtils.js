import fs from "fs";
import fetch from "node-fetch";
import { config } from "../config/environment.js";
import { logger } from "./logger.js";
import { dropboxService } from "../services/dropboxService.js";

export const saveAudioAndData = async (audioUrl, jsonData) => {
  try {
    // Fetch the WAV data from the URL
    const response = await fetch(audioUrl);
    const buffer = await response.buffer();

    // Create file prefix from current date
    const uploadFilePrefix = new Date().toISOString().replace(/:/g, "-");

    // Ensure tempFiles directory exists
    if (!fs.existsSync("tempFiles")) {
      fs.mkdirSync("tempFiles", { recursive: true });
    }

    // Write files locally
    const wavPath = `tempFiles/${uploadFilePrefix}.wav`;
    const jsonPath = `tempFiles/${uploadFilePrefix}.json`;
    
    fs.writeFileSync(wavPath, buffer);
    fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));

    // Upload to Dropbox
    await dropboxService.uploadFile(wavPath, config.server.clientPathPrefix, `${uploadFilePrefix}.wav`);
    await dropboxService.uploadFile(jsonPath, config.server.clientPathPrefix, `${uploadFilePrefix}.json`);

    logger.debug("Files saved and uploaded successfully");
  } catch (error) {
    logger.error("Error in saveAudioAndData:", error);
    throw error;
  }
};

export const savePromptToFile = (prompt) => {
  try {
    if (!fs.existsSync("tempFiles")) {
      fs.mkdirSync("tempFiles", { recursive: true });
    }
    fs.writeFileSync("tempFiles/prompt.txt", prompt);
    logger.debug("Prompt saved to file");
  } catch (error) {
    logger.error("Error saving prompt to file:", error);
  }
};


