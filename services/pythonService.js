import { spawn } from "child_process";
import { config } from "../config/environment.js";
import { logger } from "../utils/logger.js";

class PythonService {
  async executePythonScript(scriptPath, args) {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn(config.python.path, [scriptPath, ...args]);
      
      let stdoutData = "";
      let stderrData = "";

      pythonProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
      });

      pythonProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
        logger.error(`Python stderr: ${data.toString()}`);
      });

      pythonProcess.on("close", (code) => {
        logger.debug(`Child process exited with code ${code}`);
        
        if (code !== 0) {
          reject(new Error(`Python process failed with code ${code}: ${stderrData}`));
          return;
        }

        try {
          const jsonData = JSON.parse(stdoutData);
          resolve(jsonData);
        } catch (error) {
          logger.error("Error parsing JSON:", error);
          reject(new Error("Server error parsing Python response."));
        }
      });

      pythonProcess.on("error", (error) => {
        logger.error("Failed to start Python process:", error);
        reject(error);
      });
    });
  }

  async getWaterDistance(lat, lon) {
    return this.executePythonScript("distance_to_water/distance_to_water.py", [lat, lon]);
  }

  async checkIsInAustralia(lat, lon) {
    return this.executePythonScript("isInAustralia/isInAustralia.py", [lat, lon]);
  }

  async controlHugSpace(command) {
    return this.executePythonScript("space_control/control_space.py", [command]);
  }
}

export const pythonService = new PythonService();


