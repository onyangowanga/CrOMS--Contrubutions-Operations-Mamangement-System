import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, requireRole } from "../middleware/auth";

const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

campaignsRouter.get("/", async (_req, res) => {
  const result = await pool.query(
    "SELECT c.*, g.name AS group_name FROM campaigns c JOIN groups g ON g.id = c.group_id ORDER BY c.created_at DESC"
  );
  res.json(result.rows);
});

campaignsRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  const { name, groupId, targetAmount, status } = req.body;

  if (!name || !groupId) {
    return res.status(400).json({ error: "name and groupId are required" });
  }

  const campaign = await pool.query(
    "INSERT INTO campaigns (group_id, name, target_amount, status) VALUES ($1, $2, $3, $4) RETURNING *",
    [groupId, name, targetAmount ? Number(targetAmount) : null, status ?? "active"]
  );

  return res.status(201).json(campaign.rows[0]);
});

campaignsRouter.patch("/:id/target", requireRole("admin", "treasurer"), async (req, res) => {
  const targetAmount = Number(req.body.targetAmount);

  if (Number.isNaN(targetAmount)) {
    return res.status(400).json({ error: "targetAmount must be a number" });
  }

  const updated = await pool.query(
    "UPDATE campaigns SET target_amount = $2 WHERE id = $1 RETURNING *",
    [req.params.id, targetAmount]
  );
  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  return res.json(updated.rows[0]);
});

campaignsRouter.patch("/:id/status", requireRole("admin", "treasurer"), async (req, res) => {
  const { status } = req.body;

  if (!["active", "closed"].includes(String(status))) {
    return res.status(400).json({ error: "status must be active or closed" });
  }

  const updated = await pool.query(
    "UPDATE campaigns SET status = $2::campaign_status WHERE id = $1 RETURNING *",
    [req.params.id, status]
  );

  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  return res.json(updated.rows[0]);
});

campaignsRouter.post("/:id/payment-methods", requireRole("admin", "treasurer"), async (req, res) => {
  const { methodType, value, label } = req.body;

  if (!methodType || !value || !label) {
    return res.status(400).json({ error: "methodType, value, and label are required" });
  }

  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [req.params.id]);
  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const paymentMethod = await pool.query(
    "INSERT INTO payment_methods (campaign_id, method_type, value, label) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, methodType, value, label]
  );

  return res.status(201).json(paymentMethod.rows[0]);
});

campaignsRouter.get("/:id/summary", async (req, res) => {
  const campaign = await pool.query("SELECT * FROM campaigns WHERE id = $1", [req.params.id]);
  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const contributors = await pool.query(
    "SELECT * FROM contributors WHERE campaign_id = $1 ORDER BY total_contributed DESC",
    [req.params.id]
  );
  const paymentMethods = await pool.query(
    "SELECT * FROM payment_methods WHERE campaign_id = $1 ORDER BY created_at ASC",
    [req.params.id]
  );

  const campaignRow = campaign.rows[0];
  const totalRaised = Number(campaignRow.total_raised);
  const targetAmount = campaignRow.target_amount ? Number(campaignRow.target_amount) : null;
  const deficit = targetAmount === null ? null : Math.max(targetAmount - totalRaised, 0);

  return res.json({
    campaign: campaignRow,
    contributors: contributors.rows,
    paymentMethods: paymentMethods.rows,
    deficit,
  });
});

export { campaignsRouter };
