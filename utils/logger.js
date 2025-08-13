import pino from "pino";
import { config } from "../config/environment.js";

export const logger = pino({
  level: config.logging.level,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      ignore: "pid,hostname",
      singleLine: false,
      messageFormat: "{levelLabel} - {msg} - {req.method} {req.url}",
    },
  },
});

export const createRequestLogger = (req, res, next) => {
  req.logger = logger.child({
    requestId: req.id || Math.random().toString(36).substr(2, 9),
    method: req.method,
    url: req.url,
  });
  next();
};

