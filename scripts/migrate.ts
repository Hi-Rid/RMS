import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const url = process.env.DIRECT_URL;
if (!url) {
    console.error("DIRECT_URL is not set in .env.local");
    process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1 });

async function main() {
    await sql`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `;

    const dir = join(process.cwd(), "db", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

    const applied = new Set(
        (await sql<{ name: string }[]>`select name from schema_migrations`).map(
            (r) => r.name
        )
    );

    for (const file of files) {
        if (applied.has(file)) {
            console.log(`skip ${file}`);
            continue;
        }
        const body = readFileSync(join(dir, file), "utf8");
        console.log(`apply ${file}`);
        try {
            await sql.begin(async (tx) => {
                await tx.unsafe(body);
                await tx`insert into schema_migrations (name) values (${file})`;
            });
            console.log(`ok ${file}`);
        } catch (e) {
            console.error(`fail ${file}`, e);
            process.exit(1);
        }
    }

    await sql.end();
}

main();