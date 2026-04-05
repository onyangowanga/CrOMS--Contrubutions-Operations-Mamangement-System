import { Router } from "express";
import { generateWhatsappSummary } from "../services/summary";
import { pool } from "../db/client";
import { requireAuth } from "../middleware/auth";

const summaryRouter = Router();
summaryRouter.use(requireAuth);

summaryRouter.get("/:campaignId/whatsapp", async (req, res) => {
  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [req.params.campaignId]);

  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const summary = await generateWhatsappSummary(req.params.campaignId);

  return res.json({
    campaignId: req.params.campaignId,
    summary,
  });
});

export { summaryRouter };
