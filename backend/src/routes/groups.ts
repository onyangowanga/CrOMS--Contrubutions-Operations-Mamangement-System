import { Router } from "express";
import { pool } from "../db/client";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth";

const groupsRouter = Router();
groupsRouter.use(requireAuth);

groupsRouter.get("/", async (_req, res) => {
  const result = await pool.query(
    "SELECT g.*, u.full_name AS creator_name FROM groups g JOIN users u ON u.id = g.created_by ORDER BY g.created_at DESC"
  );
  return res.json(result.rows);
});

groupsRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  const { name, description, brandName, brandColor, brandLogoPath } = req.body;
  const user = (req as AuthedRequest).user;

  if (!name) {
    return res.status(400).json({ error: "name is required" });
  }

  const created = await pool.query(
    `
    INSERT INTO groups (name, description, brand_name, brand_color, brand_logo_path, created_by)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
    `,
    [name, description ?? null, brandName ?? null, brandColor ?? null, brandLogoPath ?? null, user.id]
  );

  await pool.query(
    "INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (group_id, user_id) DO NOTHING",
    [created.rows[0].id, user.id, user.role]
  );

  return res.status(201).json(created.rows[0]);
});

groupsRouter.patch("/:groupId", requireRole("admin", "treasurer"), async (req, res) => {
  const { name, description, brandName, brandColor, brandLogoPath } = req.body;
  const updated = await pool.query(
    `
    UPDATE groups
    SET name = COALESCE($2, name),
        description = COALESCE($3, description),
        brand_name = COALESCE($4, brand_name),
        brand_color = COALESCE($5, brand_color),
        brand_logo_path = COALESCE($6, brand_logo_path)
    WHERE id = $1
    RETURNING *
    `,
    [req.params.groupId, name ?? null, description ?? null, brandName ?? null, brandColor ?? null, brandLogoPath ?? null]
  );

  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Group not found" });
  }

  return res.json(updated.rows[0]);
});

groupsRouter.delete("/:groupId", requireRole("admin", "treasurer"), async (req, res) => {
  const deleted = await pool.query("DELETE FROM groups WHERE id = $1 RETURNING id", [req.params.groupId]);
  if ((deleted.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Group not found" });
  }

  return res.json({ deleted: true, id: req.params.groupId });
});

groupsRouter.post("/:groupId/members", requireRole("admin", "treasurer"), async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !role) {
    return res.status(400).json({ error: "userId and role are required" });
  }

  const inserted = await pool.query(
    "INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (group_id, user_id) DO UPDATE SET role = EXCLUDED.role RETURNING *",
    [req.params.groupId, userId, role]
  );

  return res.status(201).json(inserted.rows[0]);
});

groupsRouter.get("/:groupId/members", async (req, res) => {
  const result = await pool.query(
    "SELECT gm.*, u.full_name, u.email FROM group_members gm JOIN users u ON u.id = gm.user_id WHERE gm.group_id = $1 ORDER BY gm.created_at DESC",
    [req.params.groupId]
  );
  return res.json(result.rows);
});

groupsRouter.delete("/:groupId/members/:userId", requireRole("admin", "treasurer"), async (req, res) => {
  const deleted = await pool.query(
    "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING id",
    [req.params.groupId, req.params.userId]
  );

  if ((deleted.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Group member not found" });
  }

  return res.json({ deleted: true, groupId: req.params.groupId, userId: req.params.userId });
});

export { groupsRouter };
