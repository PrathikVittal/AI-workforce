import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ?? `postgresql://${process.env.USER}@localhost:5432/scrum`;

// Reuse the pool across HMR reloads in dev so we don't exhaust connections.
const globalForDb = globalThis as unknown as { _pgPool?: Pool };
const pool = globalForDb._pgPool ?? new Pool({ connectionString: url });
if (process.env.NODE_ENV !== "production") globalForDb._pgPool = pool;

export const db = drizzle(pool, { schema });

export * from "./schema";
