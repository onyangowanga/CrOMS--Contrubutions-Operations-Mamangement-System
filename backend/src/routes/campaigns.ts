import { Router } from "express";
import { pool } from "../db/client";
import { getRequestUser, requireAuth, requireRole } from "../middleware/auth";
import { getAccessibleCampaign, hasGroupAccess, isAdminUser } from "../lib/access";

const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

campaignsRouter.get("/", async (req, res) => {
  const user = getRequestUser(req);
  const result = isAdminUser(user)
    ? await pool.query(
      "SELECT c.*, g.name AS group_name FROM campaigns c JOIN groups g ON g.id = c.group_id ORDER BY c.created_at DESC"
    )
    : await pool.query(
      `
      SELECT c.*, g.name AS group_name
      FROM campaigns c
      JOIN groups g ON g.id = c.group_id
      JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
      ORDER BY c.created_at DESC
      `,
      [user.id]
    );
  res.json(result.rows);
});

campaignsRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  const { name, groupId, targetAmount, status, whatsappHeaderText, whatsappAdditionalInfo } = req.body;
  const { fixedContributionAmount } = req.body;
  const user = getRequestUser(req);

  if (!name || !groupId) {
    return res.status(400).json({ error: "name and groupId are required" });
  }

  const canAccessGroup = await hasGroupAccess(user, groupId);
  if (!canAccessGroup) {
    return res.status(404).json({ error: "Group not found" });
  }

  const campaign = await pool.query(
     "INSERT INTO campaigns (group_id, name, target_amount, fixed_contribution_amount, whatsapp_header_text, whatsapp_additional_info, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
    [
      groupId,
      name,
      targetAmount ? Number(targetAmount) : null,
      fixedContributionAmount === undefined || fixedContributionAmount === null || fixedContributionAmount === "" ? null : Number(fixedContributionAmount),
      whatsappHeaderText ?? null,
      whatsappAdditionalInfo ?? null,
      status ?? "active",
    ]
  );

  return res.status(201).json(campaign.rows[0]);
});

campaignsRouter.patch("/:id", requireRole("admin", "treasurer"), async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const {
    name,
    targetAmount,
    fixedContributionAmount,
    whatsappHeaderText,
    whatsappAdditionalInfo,
  } = req.body;

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedTargetAmount = targetAmount === undefined || targetAmount === null || targetAmount === ""
    ? null
    : Number(targetAmount);
  const normalizedFixedContributionAmount = fixedContributionAmount === undefined || fixedContributionAmount === null || fixedContributionAmount === ""
    ? null
    : Number(fixedContributionAmount);

  if (!normalizedName) {
    return res.status(400).json({ error: "name is required" });
  }

  if (normalizedTargetAmount !== null && (!Number.isFinite(normalizedTargetAmount) || normalizedTargetAmount < 0)) {
    return res.status(400).json({ error: "targetAmount must be a non-negative number or null" });
  }

  if (normalizedFixedContributionAmount !== null && (!Number.isFinite(normalizedFixedContributionAmount) || normalizedFixedContributionAmount < 0)) {
    return res.status(400).json({ error: "fixedContributionAmount must be a non-negative number or null" });
  }

  const updated = await pool.query(
    `
    UPDATE campaigns
    SET name = $2,
        target_amount = $3,
        fixed_contribution_amount = $4,
        whatsapp_header_text = $5,
        whatsapp_additional_info = $6
    WHERE id = $1
    RETURNING *
    `,
    [
      req.params.id,
      normalizedName,
      normalizedTargetAmount,
      normalizedFixedContributionAmount,
      whatsappHeaderText === undefined ? null : whatsappHeaderText,
      whatsappAdditionalInfo === undefined ? null : whatsappAdditionalInfo,
    ]
  );

  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  return res.json(updated.rows[0]);
});

campaignsRouter.patch("/:id/target", requireRole("admin", "treasurer"), async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

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

campaignsRouter.patch("/:id/fixed-amount", requireRole("admin", "treasurer"), async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const value = req.body.fixedContributionAmount;
  const fixedContributionAmount = value === null || value === "" || value === undefined ? null : Number(value);

  if (fixedContributionAmount !== null && (!Number.isFinite(fixedContributionAmount) || fixedContributionAmount < 0)) {
    return res.status(400).json({ error: "fixedContributionAmount must be a non-negative number or null" });
  }

  const updated = await pool.query(
    "UPDATE campaigns SET fixed_contribution_amount = $2 WHERE id = $1 RETURNING *",
    [req.params.id, fixedContributionAmount]
  );
  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  return res.json(updated.rows[0]);
});

campaignsRouter.patch("/:id/status", requireRole("admin", "treasurer"), async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

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
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

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
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.id);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

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
