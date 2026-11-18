import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
    console.error("DATABASE_URL is not set in .env.local");
    process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

const tables = [
    "pillars",
    "series",
    "hook_types",
    "platforms",
    "formats",
    "app_settings",
    "refs",
    "contents",
    "posts",
    "snapshots",
    "audios",
    "source_accounts",
] as const;

async function main() {
    for (const t of tables) {
        const [row] = await sql.unsafe<{ n: number }[]>(
            `select count(*)::int as n from "${t}"`
        );
        console.log(`${t.padEnd(16)} ${row.n}`);
    }
    await sql.end();
}

main();