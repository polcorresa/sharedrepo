import { config } from 'dotenv';
import { z } from 'zod';

// Load .env file from root
config();

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  APP_SECRET: z
    .string()
    .min(32, 'APP_SECRET must be at least 32 characters'),
  COOKIE_NAME: z.string().default('sharedrepo_token'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '❌ Invalid environment variables:',
    parsed.error.flatten().fieldErrors
  );
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
