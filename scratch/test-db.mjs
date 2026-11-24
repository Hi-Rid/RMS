import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

console.log("DB URL:", process.env.DATABASE_URL ? "Exists" : "Missing");

const sql = postgres(process.env.DATABASE_URL, {
  connect_timeout: 4,
  max: 1,
});

const start = Date.now();
try {
  console.log("Attempting query...");
  const res = await sql`SELECT 1 as test`;
  console.log("Query succeeded in", Date.now() - start, "ms:", res);
} catch (err) {
  console.error("Query failed in", Date.now() - start, "ms:", err);
} finally {
  await sql.end({ timeout: 1 });
  process.exit(0);
}
