import { Router } from "express";
import { pool } from "../db/client";
import { getRequestUser, requireAuth, requireRole } from "../middleware/auth";
import { getAccessibleCampaign } from "../lib/access";

const paymentMethodsRouter = Router();
paymentMethodsRouter.use(requireAuth);

paymentMethodsRouter.get("/campaign/:campaignId", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const result = await pool.query(
    "SELECT * FROM payment_methods WHERE campaign_id = $1 ORDER BY created_at ASC",
    [req.params.campaignId]
  );
  return res.json(result.rows);
});

paymentMethodsRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  const { campaignId, methodType, value, label, accountReference } = req.body;

  if (!campaignId || !methodType || !value || !label) {
    return res.status(400).json({ error: "campaignId, methodType, value, and label are required" });
  }

  if (methodType === "paybill" && !(typeof accountReference === "string" && accountReference.trim())) {
    return res.status(400).json({ error: "accountReference is required for paybill methods" });
  }

  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const result = await pool.query(
    "INSERT INTO payment_methods (campaign_id, method_type, value, account_reference, label) VALUES ($1, $2::payment_method_type, $3, $4, $5) RETURNING *",
    [campaignId, methodType, value, accountReference ?? null, label]
  );

  return res.status(201).json(result.rows[0]);
});

paymentMethodsRouter.patch("/:id", requireRole("admin", "treasurer"), async (req, res) => {
  const { methodType, value, label, accountReference } = req.body;
  const paymentMethod = await pool.query(
    "SELECT pm.id, pm.campaign_id FROM payment_methods pm WHERE pm.id = $1",
    [req.params.id]
  );

  if ((paymentMethod.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), paymentMethod.rows[0].campaign_id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  const result = await pool.query(
    `
    UPDATE payment_methods
    SET method_type = COALESCE($2::payment_method_type, method_type),
        value = COALESCE($3, value),
        account_reference = COALESCE($4, account_reference),
        label = COALESCE($5, label)
    WHERE id = $1
    RETURNING *
    `,
    [req.params.id, methodType ?? null, value ?? null, accountReference ?? null, label ?? null]
  );

  if ((result.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  return res.json(result.rows[0]);
});

paymentMethodsRouter.delete("/:id", requireRole("admin", "treasurer"), async (req, res) => {
  const paymentMethod = await pool.query(
    "SELECT pm.id, pm.campaign_id FROM payment_methods pm WHERE pm.id = $1",
    [req.params.id]
  );

  if ((paymentMethod.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), paymentMethod.rows[0].campaign_id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  const result = await pool.query("DELETE FROM payment_methods WHERE id = $1 RETURNING id", [req.params.id]);

  if ((result.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  return res.json({ deleted: true, id: req.params.id });
});

export { paymentMethodsRouter };
