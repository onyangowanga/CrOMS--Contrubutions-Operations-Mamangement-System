import { Router } from "express";
import { generateWhatsappSummary } from "../services/summary";
import { pool } from "../db/client";
import { getRequestUser, requireAuth } from "../middleware/auth";
import { getAccessibleCampaign } from "../lib/access";

const summaryRouter = Router();
summaryRouter.use(requireAuth);

summaryRouter.get("/:campaignId/whatsapp", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [req.params.campaignId]);

  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const summary = await generateWhatsappSummary(req.params.campaignId, {
    headerText: req.query.headerText ? String(req.query.headerText) : undefined,
    additionalInfo: req.query.additionalInfo ? String(req.query.additionalInfo) : undefined,
    includeTarget: req.query.includeTarget === undefined ? true : String(req.query.includeTarget) === "true",
    includeDeficit: req.query.includeDeficit === undefined ? true : String(req.query.includeDeficit) === "true",
  });

  return res.json({
    campaignId: req.params.campaignId,
    summary,
  });
});

export { summaryRouter };
