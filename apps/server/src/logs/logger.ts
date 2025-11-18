import pino from 'pino';
import { env, isProduction } from '../config/env.js';

/**
 * Custom serializers for structured logging
 * These ensure sensitive data is not logged and objects are properly formatted
 */
const serializers = {
  // Serialize request objects
  req: (req: any) => ({
    id: req.id,
    method: req.method,
    url: req.url,
    hostname: req.hostname,
    remoteAddress: req.ip,
    remotePort: req.socket?.remotePort,
    // Don't log headers by default (may contain sensitive data)
    // headers: req.headers,
  }),

  // Serialize response objects
  res: (res: any) => ({
    statusCode: res.statusCode,
  }),

  // Serialize errors with stack traces
  err: pino.stdSerializers.err,
};

/**
 * Base logger configuration
 */
const baseConfig: pino.LoggerOptions = {
  level: env.LOG_LEVEL,
  serializers,
  // Add timestamp in ISO format
  timestamp: pino.stdTimeFunctions.isoTime,
  // Don't redact fields by default, but could add sensitive field names here
  // redact: ['req.headers.authorization', 'req.headers.cookie'],
};

/**
 * Production logger configuration
 * Outputs JSON for log aggregation services
 */
const productionConfig: pino.LoggerOptions = {
  ...baseConfig,
  // Production: structured JSON output
  formatters: {
    level: (label) => ({ level: label }),
  },
};

/**
 * Development logger configuration
 * Uses pino-pretty for human-readable output
 */
const developmentConfig: pino.LoggerOptions = {
  ...baseConfig,
  // Development: pretty-printed output
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:HH:MM:ss',
      colorize: true,
      ignore: 'pid,hostname',
      // Show error stack traces
      errorLikeObjectKeys: ['err', 'error'],
      // Custom message format
      messageFormat: '{msg}',
      // Suppress some noisy logs in development
      customLevels: 'fatal:60,error:50,warn:40,info:30,debug:20,trace:10',
    },
  },
};

/**
 * Main application logger
 * Automatically configured based on NODE_ENV
 */
export const logger = pino(isProduction ? productionConfig : developmentConfig);

/**
 * Create a child logger with additional context
 * 
 * @example
 * const requestLogger = createLogger({ requestId: '123', userId: '456' });
 * requestLogger.info('Processing request');
 */
export const createLogger = (bindings: Record<string, any>) => {
  return logger.child(bindings);
};
