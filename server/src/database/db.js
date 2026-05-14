import fs from "node:fs/promises";
import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

export const pool = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      ssl: env.isProduction || env.databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined
    })
  : null;

let databaseAvailable = Boolean(pool);

export function isDatabaseConfigured() {
  return Boolean(pool && databaseAvailable);
}

export async function query(text, params = []) {
  if (!isDatabaseConfigured()) {
    throw new Error("DATABASE_URL is not configured or the database is unavailable.");
  }
  return pool.query(text, params);
}

export async function initializeDatabase() {
  if (!pool) {
    return false;
  }
  try {
    const schema = await fs.readFile(new URL("./schema.sql", import.meta.url), "utf8");
    await pool.query(schema);
    databaseAvailable = true;
    return true;
  } catch (error) {
    databaseAvailable = false;
    if (env.isProduction) throw error;
    console.warn(`[database] DATABASE_URL is configured but unavailable (${error.code || error.message}). Falling back to file storage.`);
    return false;
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
  }
}
