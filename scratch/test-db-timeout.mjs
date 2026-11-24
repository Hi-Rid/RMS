import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const sql = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 10,
  idle_timeout: 15,
  connect_timeout: 4,
  queue_timeout: 3,
  query_timeout: 4,
});

const t0 = Date.now();
try {
  const res = await sql`SELECT 1 as test`;
  console.log("Success with timeouts in", Date.now() - t0, "ms:", res);
} catch (e) {
  console.error("Error:", e);
} finally {
  await sql.end({ timeout: 1 });
  process.exit(0);
}
