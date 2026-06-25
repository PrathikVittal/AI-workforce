import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url =
  process.env.DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/scrum`;
const pool = new Pool({ connectionString: url });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle" });
console.log(`✓ migrations applied to ${url}`);
await pool.end();
