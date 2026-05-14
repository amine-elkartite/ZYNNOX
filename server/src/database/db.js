import fs from "node:fs/promises";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.isProduction ? { rejectUnauthorized: false } : undefined
    })
  : null;

export function isDatabaseConfigured() {
  return Boolean(pool);
}

export async function query(text, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }
  return pool.query(text, params);
}

export async function initializeDatabase() {
  if (!pool) {
    return;
  }
  const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
  await pool.query(schema);
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}
