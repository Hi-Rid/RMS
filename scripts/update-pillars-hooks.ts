import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
const sql = postgres(url, { prepare: false, max: 1 });

const newPillars = [
  { name: "Fashion", slug: "fashion", sortOrder: 1 },
  { name: "OOTD", slug: "ootd", sortOrder: 2 },
  { name: "Art", slug: "art", sortOrder: 3 },
  { name: "Sketching", slug: "sketching", sortOrder: 4 },
  { name: "Journal", slug: "journal", sortOrder: 5 },
  { name: "DIY", slug: "diy", sortOrder: 6 },
  { name: "Craft", slug: "craft", sortOrder: 7 },
  { name: "Custom", slug: "custom", sortOrder: 8 },
  { name: "Rework", slug: "rework", sortOrder: 9 },
  { name: "Lifestyle", slug: "lifestyle", sortOrder: 10 },
  { name: "Selfcare", slug: "selfcare", sortOrder: 11 },
  { name: "Glow Up", slug: "glow-up", sortOrder: 12 },
  { name: "Beauty", slug: "beauty", sortOrder: 13 },
  { name: "Skincare", slug: "skincare", sortOrder: 14 },
  { name: "Room Setup", slug: "room-setup", sortOrder: 15 },
  { name: "Desk Setup", slug: "desk-setup", sortOrder: 16 },
  { name: "Food & Culinary", slug: "food-culinary", sortOrder: 17 },
  { name: "Cafe & Coffee", slug: "cafe-coffee", sortOrder: 18 },
  { name: "Travel & Places", slug: "travel-places", sortOrder: 19 },
  { name: "Productivity & Work", slug: "productivity-work", sortOrder: 20 },
];

const newHooks = [
  { name: "POV", slug: "pov", sortOrder: 1 },
  { name: "Before / after", slug: "before-after", sortOrder: 2 },
  { name: "Question", slug: "question", sortOrder: 3 },
  { name: "Bold statement", slug: "bold-statement", sortOrder: 4 },
  { name: "List (listicle)", slug: "listicle", sortOrder: 5 },
  { name: "Reveal / transformation", slug: "reveal", sortOrder: 6 },
  { name: "Relatable moment", slug: "relatable", sortOrder: 7 },
  { name: "Tutorial / how-to", slug: "tutorial", sortOrder: 8 },
  { name: "Storytime", slug: "storytime", sortOrder: 9 },
  { name: "Stop doing this (mistake)", slug: "mistake", sortOrder: 10 },
  { name: "Challenge / time limit", slug: "challenge", sortOrder: 11 },
  { name: "Curiosity gap (wait for it)", slug: "curiosity-gap", sortOrder: 12 },
  { name: "Day in my life / routine", slug: "routine", sortOrder: 13 },
  { name: "Unpopular opinion (Contrarian)", slug: "unpopular-opinion", sortOrder: 14 },
  { name: "The secret nobody tells you (Insider)", slug: "secret-insider", sortOrder: 15 },
  { name: "Things I wish I knew earlier", slug: "things-i-wish-i-knew", sortOrder: 16 },
  { name: "Rating / Tier list", slug: "rating-tier-list", sortOrder: 17 },
  { name: "Behind the scenes (Process)", slug: "behind-the-scenes", sortOrder: 18 },
  { name: "Don't do / buy this until you watch", slug: "dont-buy-warning", sortOrder: 19 },
  { name: "How I did X in Y days (Proof)", slug: "case-study-proof", sortOrder: 20 },
  { name: "Expectation vs Reality", slug: "expectation-vs-reality", sortOrder: 21 },
  { name: "Mini vlog / Aesthetic montage", slug: "mini-vlog-aesthetic", sortOrder: 22 },
  { name: "Life hack / Quick cheat code", slug: "life-hack-cheat-code", sortOrder: 23 },
  { name: "Problem / Agitate / Solution", slug: "problem-solution", sortOrder: 24 },
];

async function updateData() {
  console.log("Updating pillars...");

  // 1. Rename existing "Fashion / OOTD" to "Fashion" so existing references don't break
  await sql`UPDATE pillars SET name = 'Fashion', slug = 'fashion' WHERE slug = 'fashion-ootd'`;

  // 2. Insert new individual pillars
  for (const p of newPillars) {
    await sql`
      INSERT INTO pillars (name, slug, sort_order, is_active)
      VALUES (${p.name}, ${p.slug}, ${p.sortOrder}, true)
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true
    `;
  }

  // 3. Remove old combined pillars if not used
  const oldCombined = [
    "art-sketching-journal",
    "diy-craft-rework",
    "lifestyle-selfcare",
    "beauty-skincare",
    "room-desk-setup",
    "food-cafe",
  ];

  for (const slug of oldCombined) {
    const [row] = await sql`SELECT id FROM pillars WHERE slug = ${slug}`;
    if (row) {
      const [usage] = await sql`SELECT count(*)::int as n FROM ref_pillars WHERE pillar_id = ${row.id}`;
      if (usage.n === 0) {
        await sql`DELETE FROM pillars WHERE id = ${row.id}`;
        console.log(`Deleted unused combined pillar: ${slug}`);
      } else {
        await sql`UPDATE pillars SET is_active = false WHERE id = ${row.id}`;
        console.log(`Deactivated used combined pillar: ${slug}`);
      }
    }
  }

  console.log("Updating hook types...");
  for (const h of newHooks) {
    await sql`
      INSERT INTO hook_types (name, slug, sort_order, is_active)
      VALUES (${h.name}, ${h.slug}, ${h.sortOrder}, true)
      ON CONFLICT (slug) DO UPDATE
      SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = true
    `;
  }

  const finalPillars = await sql`SELECT name, slug FROM pillars WHERE is_active = true ORDER BY sort_order`;
  console.log("Active pillars count:", finalPillars.length);
  const finalHooks = await sql`SELECT name, slug FROM hook_types WHERE is_active = true ORDER BY sort_order`;
  console.log("Active hook types count:", finalHooks.length);

  await sql.end();
  console.log("Database update completed successfully.");
}

updateData().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
