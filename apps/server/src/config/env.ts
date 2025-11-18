import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
config();

/**
 * Environment variable schema with validation
 * All required variables must be set or the server will fail to start
 */
const envSchema = z.object({
  // Environment
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development')
    .describe('Current environment'),

  // Server
  PORT: z.coerce
    .number()
    .int()
    .positive()
    .default(4000)
    .describe('Port for HTTP server'),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .describe('PostgreSQL connection string'),

  // Security
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters for security')
    .describe('Secret key for signing JWT tokens'),

  COOKIE_SECRET: z
    .string()
    .min(32, 'COOKIE_SECRET must be at least 32 characters for security')
    .describe('Secret key for signing cookies'),

  // CORS
  WEB_ORIGIN: z
    .string()
    .url()
    .describe('Allowed origin for CORS (frontend URL)'),

  // WebSocket
  YJS_WS_PATH: z
    .string()
    .default('/ws/yjs')
    .describe('WebSocket path for Yjs collaboration'),

  // Logging
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info')
    .describe('Minimum log level to output'),
});

/**
 * Parse and validate environment variables
 */
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
  console.error('\n💡 Check your .env file and ensure all required variables are set.');
  process.exit(1);
}

/**
 * Validated and typed environment configuration
 * Safe to use throughout the application
 */
export const env = parsed.data;

/**
 * Check if running in production
 */
export const isProduction = env.NODE_ENV === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = env.NODE_ENV === 'development';

/**
 * Check if running in test
 */
export const isTest = env.NODE_ENV === 'test';
