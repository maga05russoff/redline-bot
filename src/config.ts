import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  DISCORD_GUILD_ID: z.string().min(1),
  BOT_OWNER_ID: z.string().min(1),
  // Discord ID администраторов бота через запятую. Например: 111...,222...
  BOT_ADMIN_IDS: z.string().default(''),
  DATABASE_URL: z.string().min(1),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);
