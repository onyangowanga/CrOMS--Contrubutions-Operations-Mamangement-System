import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, requireRole } from "../middleware/auth";

const contributorsRouter = Router();
contributorsRouter.use(requireAuth);

contributorsRouter.get("/:campaignId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM contributors WHERE campaign_id = $1 ORDER BY total_contributed DESC",
    [req.params.campaignId]
  );

  return res.json(result.rows);
});

contributorsRouter.post("/:id/add-sender", requireRole("admin", "treasurer"), async (req, res) => {
  const { senderName } = req.body;

  if (!senderName) {
    return res.status(400).json({ error: "senderName is required" });
  }

  const contributorResult = await pool.query(
    "SELECT id, alternate_senders FROM contributors WHERE id = $1",
    [req.params.id]
  );
  if ((contributorResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Contributor not found" });
  }

  const contributor = contributorResult.rows[0] as { id: string; alternate_senders: string[] };
  const current = Array.isArray(contributor.alternate_senders) ? contributor.alternate_senders : [];
  const updated = current.includes(senderName) ? current : [...current, senderName];

  const saved = await pool.query(
    "UPDATE contributors SET alternate_senders = $2::jsonb WHERE id = $1 RETURNING *",
    [req.params.id, JSON.stringify(updated)]
  );

  return res.json(saved.rows[0]);
});

export { contributorsRouter };
