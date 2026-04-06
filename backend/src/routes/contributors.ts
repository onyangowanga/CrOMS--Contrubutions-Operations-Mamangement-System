import { Router } from "express";
import { pool } from "../db/client";
import { getRequestUser, requireAuth, requireRole } from "../middleware/auth";
import { getAccessibleCampaign } from "../lib/access";

const contributorsRouter = Router();
contributorsRouter.use(requireAuth);

contributorsRouter.get("/:campaignId", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

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
    "SELECT c.id, c.alternate_senders, c.campaign_id FROM contributors c WHERE c.id = $1",
    [req.params.id]
  );
  if ((contributorResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Contributor not found" });
  }

  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), contributorResult.rows[0].campaign_id);
  if (!accessibleCampaign) {
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
