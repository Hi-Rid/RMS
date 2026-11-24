import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import * as relations from "@/db/relations";

const g = globalThis as unknown as { pg?: ReturnType<typeof postgres> };
const client =
  g.pg ??
  postgres(process.env.DATABASE_URL!, {
    prepare: false,
    max: process.env.NODE_ENV === "production" ? 1 : 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
if (process.env.NODE_ENV !== "production") g.pg = client;

export const db = drizzle(client, { schema: { ...schema, ...relations } });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export const withTx = <T>(fn: (tx: Tx) => Promise<T>) => db.transaction(fn);
