import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Router } from "express";
import { signToken } from "../lib/auth";
import { requireAuth, requireRole } from "../middleware/auth";
import { pool } from "../db/client";

const authRouter = Router();

authRouter.post("/register", requireAuth, requireRole("admin"), async (req, res) => {
  const { fullName, email, password, role } = req.body;

  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: "fullName, email, password, and role are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
  if ((existing.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const hash = await bcrypt.hash(String(password), 10);
  const created = await pool.query(
    "INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, full_name, email, role",
    [fullName, normalizedEmail, hash, role]
  );

  return res.status(201).json(created.rows[0]);
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const userResult = await pool.query(
    "SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1",
    [normalizedEmail]
  );

  if ((userResult.rowCount ?? 0) === 0) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const user = userResult.rows[0];
  const valid = await bcrypt.compare(String(password), user.password_hash);

  if (!valid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signToken({
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.full_name,
  });

  return res.json({
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  });
});

authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: "email is required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const token = crypto.randomBytes(24).toString("hex");

  await pool.query(
    `
    UPDATE users
    SET reset_token = $2,
        reset_token_expires_at = NOW() + INTERVAL '30 minutes'
    WHERE email = $1
    `,
    [normalizedEmail, token]
  );

  return res.json({
    message: "If the account exists, a reset token has been generated.",
    resetToken: token,
  });
});

authRouter.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: "token and password are required" });
  }

  const hash = await bcrypt.hash(String(password), 10);
  const updated = await pool.query(
    `
    UPDATE users
    SET password_hash = $2,
        reset_token = NULL,
        reset_token_expires_at = NULL
    WHERE reset_token = $1
      AND reset_token_expires_at IS NOT NULL
      AND reset_token_expires_at > NOW()
    RETURNING id
    `,
    [token, hash]
  );

  if ((updated.rowCount ?? 0) === 0) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  return res.json({ message: "Password reset successfully" });
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const authedUser = (req as any).user;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "currentPassword and newPassword are required" });
  }

  const userResult = await pool.query(
    "SELECT id, password_hash FROM users WHERE id = $1",
    [authedUser.id]
  );

  if ((userResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = userResult.rows[0];
  const valid = await bcrypt.compare(String(currentPassword), user.password_hash);

  if (!valid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const hash = await bcrypt.hash(String(newPassword), 10);
  await pool.query(
    "UPDATE users SET password_hash = $2 WHERE id = $1",
    [authedUser.id, hash]
  );

  return res.json({ message: "Password changed successfully" });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  return res.json((req as any).user);
});

authRouter.get("/users", requireAuth, requireRole("admin"), async (_req, res) => {
  const users = await pool.query(
    "SELECT id, full_name, email, role, created_at FROM users ORDER BY created_at DESC"
  );
  return res.json(users.rows);
});

export { authRouter };
