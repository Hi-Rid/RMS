/**
 * Env schema (PRD §8.4). All optional in Phase 0; tightened per phase.
 * Schedule: P1 DATABASE_URL+DIRECT_URL · P2 Supabase+OWNER_EMAIL · P11 email · P13 AI · P18 webhook.
 */
import { z } from "zod";

const schema = z.object({
    DATABASE_URL: z.string().min(1).optional(),
    DIRECT_URL: z.string().min(1).optional(),
    SUPABASE_SECRET_KEY: z.string().min(1).optional(),
    OWNER_EMAIL: z.string().email().optional(),
    CRON_SECRET: z.string().min(32).optional(),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().min(1).optional(),
    GROQ_API_KEY: z.string().min(1).optional(),
    OPENROUTER_API_KEY: z.string().min(1).optional(),
    AI_TEXT_MODEL: z.string().optional(),
    AI_VISION_MODEL: z.string().optional(),
    AI_EMBED_MODEL: z.string().optional(),
    META_APP_SECRET: z.string().optional(),
    META_VERIFY_TOKEN: z.string().optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment variables");
}

export const env = parsed.data;
export type Env = typeof env;