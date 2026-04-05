import bcrypt from "bcryptjs";
import { config } from "../config";
import { pool } from "./client";
import { schemaSql } from "./schema";

export async function initializeDatabase(): Promise<void> {
  await pool.query(schemaSql);

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [config.adminSeedEmail]);
  if (existing.rowCount && existing.rowCount > 0) {
    return;
  }

  const passwordHash = await bcrypt.hash(config.adminSeedPassword, 10);
  await pool.query(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')",
    ["System Admin", config.adminSeedEmail, passwordHash]
  );
}
