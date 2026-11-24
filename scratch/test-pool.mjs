import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 10,
  connect_timeout: 5,
});

console.log("Running 8 queries concurrently...");
const t0 = Date.now();
try {
  const results = await Promise.all([
    sql`SELECT 1 as q1`,
    sql`SELECT 2 as q2`,
    sql`SELECT 3 as q3`,
    sql`SELECT 4 as q4`,
    sql`SELECT 5 as q5`,
    sql`SELECT 6 as q6`,
    sql`SELECT 7 as q7`,
    sql`SELECT 8 as q8`,
  ]);
  console.log("8 concurrent queries succeeded in", Date.now() - t0, "ms");
} catch (err) {
  console.error("Failed:", err);
} finally {
  await sql.end({ timeout: 1 });
  process.exit(0);
}
