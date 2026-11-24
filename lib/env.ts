/**
 * Env schema (PRD §8.4). All optional in early phases; tightened per phase.
 * Schedule: P1 DATABASE_URL+DIRECT_URL · P2 Supabase+OWNER_EMAIL · P11 email · P13 AI · P18 webhook.
 */
import { z } from "zod";

const emptyAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (typeof val === "string" && val.trim() === "" ? undefined : val), schema);

const schema = z.object({
  DATABASE_URL: emptyAsUndefined(z.string().min(1).optional()),
  DIRECT_URL: emptyAsUndefined(z.string().min(1).optional()),
  SUPABASE_SECRET_KEY: emptyAsUndefined(z.string().min(1).optional()),
  OWNER_EMAIL: emptyAsUndefined(z.string().email().optional()),
  CRON_SECRET: emptyAsUndefined(z.string().min(32).optional()),
  RESEND_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  EMAIL_FROM: emptyAsUndefined(z.string().min(1).optional()),
  GOOGLE_GENERATIVE_AI_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  GROQ_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  OPENROUTER_API_KEY: emptyAsUndefined(z.string().min(1).optional()),
  AI_TEXT_MODEL: emptyAsUndefined(z.string().optional()),
  AI_VISION_MODEL: emptyAsUndefined(z.string().optional()),
  AI_EMBED_MODEL: emptyAsUndefined(z.string().optional()),
  META_APP_SECRET: emptyAsUndefined(z.string().optional()),
  META_VERIFY_TOKEN: emptyAsUndefined(z.string().optional()),
  NEXT_PUBLIC_SUPABASE_URL: emptyAsUndefined(z.string().url().optional()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: emptyAsUndefined(z.string().min(1).optional()),
  NEXT_PUBLIC_APP_URL: emptyAsUndefined(z.string().url().default("http://localhost:3000")),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = typeof env;
