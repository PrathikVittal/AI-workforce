import "dotenv/config";
import { Pool } from "pg";

// Wipes the schema so `db:reset` starts clean (Postgres has no file to rm).
const url =
  process.env.DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/scrum`;
const pool = new Pool({ connectionString: url });
await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
console.log("✓ dropped & recreated public schema");
await pool.end();
