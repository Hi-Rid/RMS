import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";

function getMasterKey(): Buffer {
  const seed =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.CRON_SECRET ||
    process.env.DATABASE_URL ||
    "rms-local-dev-secret-seed";
  return crypto.createHash("sha256").update(`rms-byok:${seed}`).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string | null | undefined): string | null {
  if (!payload || !payload.includes(".")) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;

  try {
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const encrypted = Buffer.from(parts[2], "base64url");
    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
