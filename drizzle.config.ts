import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

export default defineConfig({
    dialect: "postgresql",
    out: "./db/pulled",
    schemaFilter: ["public"],
    dbCredentials: { url: process.env.DIRECT_URL! },
});