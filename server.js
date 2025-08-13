import express from "express";
import { config, validateConfig } from "./config/environment.js";
import { logger, createRequestLogger } from "./utils/logger.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/authRoutes.js";
import apiRoutes from "./routes/apiRoutes.js";

// Validate configuration on startup
try {
  validateConfig();
  logger.info("Configuration validated successfully");
} catch (error) {
  logger.error("Configuration validation failed:", error.message);
  process.exit(1);
}

const app = express();

// Middleware
app.use(express.json());
app.use(express.static("public"));
app.use(createRequestLogger);

// Routes
app.use("/", authRoutes);
app.use(config.server.routingPrefix, apiRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`Server running on port ${config.server.port}`);
  logger.debug(`Routing prefix: ${config.server.routingPrefix}`);
  logger.debug(`Client path prefix: ${config.server.clientPathPrefix}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

export default app;


