import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const connectionString = process.env.DATABASE_URL || "";

const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };

function createClient() {
  return postgres(connectionString, {
    prepare: false, // PgBouncer transaction pooler requirement
    max: 10,
    idle_timeout: 15,
    connect_timeout: 4,
    queue_timeout: 3, // Max 3s waiting in pool queue
    query_timeout: 4, // Max 4s running any query
    onnotice: () => {},
  });
}

const client = g.pg ?? createClient();
if (process.env.NODE_ENV !== "production") g.pg = client;

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const withTx = <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn);
