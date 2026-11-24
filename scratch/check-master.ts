import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function main() {
  const p = await sql`SELECT id, name, slug FROM platforms`;
  console.log("PLATFORMS:", p);

  const f = await sql`SELECT id, name, slug FROM formats`;
  console.log("FORMATS:", f);

  const s = await sql`SELECT id, ingest_token_hash FROM app_settings`;
  console.log("SETTINGS:", s);

  await sql.end();
}

main();
