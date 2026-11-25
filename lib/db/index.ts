import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const connectionString = process.env.DATABASE_URL || "";

const g = globalThis as unknown as {
  pg?: ReturnType<typeof postgres>;
  pgVersion?: number;
};

const DB_CONFIG_VERSION = 2;

function createClient() {
  return postgres(connectionString, {
    prepare: false, // PgBouncer / Supavisor transaction pooler requirement
    max_pipeline: 1, // Disable wire pipelining (prevents stalls & QUERY_TIMEOUT on :6543 pooler)
    max: 6,
    idle_timeout: 30,
    connect_timeout: 15,
    queue_timeout: 15,
    query_timeout: 20,
    keep_alive: 30,
    onnotice: () => {},
  });
}

if (g.pg && g.pgVersion !== DB_CONFIG_VERSION) {
  void g.pg.end({ timeout: 2 }).catch(() => {});
  g.pg = undefined;
}

const client = g.pg ?? createClient();
if (process.env.NODE_ENV !== "production") {
  g.pg = client;
  g.pgVersion = DB_CONFIG_VERSION;
}

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const withTx = <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn);
