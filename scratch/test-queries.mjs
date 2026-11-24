import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { getSidebarCounts, getHomeData } from "./lib/queries/home.js";

console.log("Calling getSidebarCounts...");
const t0 = Date.now();
try {
  const counts = await getSidebarCounts();
  console.log("getSidebarCounts done in", Date.now() - t0, "ms:", counts);
} catch (e) {
  console.error("Error in getSidebarCounts:", e);
}
process.exit(0);
