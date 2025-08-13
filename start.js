#!/usr/bin/env node

import { logger } from "./utils/logger.js";
import { validateConfig } from "./config/environment.js";

// Validate configuration before starting
try {
  validateConfig();
  logger.info("Starting Synthetic Ornithology Generator Server...");
  
  // Import and start the server
  import("./server.js");
} catch (error) {
  logger.error("Failed to start server:", error.message);
  process.exit(1);
}


