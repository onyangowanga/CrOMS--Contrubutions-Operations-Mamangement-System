import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Router } from "express";
import { pool } from "../db/client";
import { getRequestUser, requireAuth, requireRole } from "../middleware/auth";
import { getAccessibleCampaign } from "../lib/access";
import { recordContribution } from "../services/contributions";
import { generateWhatsappSummary } from "../services/summary";
import { coalescePersonName, normalizePersonName } from "../utils/names";
import { handleParsedTransaction } from "./shared/parseHandler";

const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.post("/parse", requireRole("admin", "treasurer"), async (req, res) => {
  return handleParsedTransaction(req, res);
});

transactionsRouter.post("/manual", requireRole("admin", "treasurer"), async (req, res) => {
  const { campaignId, contributorId, displayName, identityType, amount, referenceCode, note, eventTime } = req.body;
  const user = getRequestUser(req);

  if (!campaignId || amount === undefined || amount === null || amount === "") {
    return res.status(400).json({ error: "campaignId and amount are required" });
  }

  const accessibleCampaign = await getAccessibleCampaign(user, campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: "amount must be a positive number" });
  }

  const normalizedDisplayName = normalizePersonName(displayName);
  if (!contributorId && !normalizedDisplayName) {
    return res.status(400).json({ error: "displayName is required when no existing contributor is selected" });
  }

  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [campaignId]);
  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const transactionCode = typeof referenceCode === "string" && referenceCode.trim()
    ? referenceCode.trim().toUpperCase()
    : `CASH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

  const duplicate = await pool.query("SELECT id FROM transactions WHERE transaction_code = $1", [transactionCode]);
  if ((duplicate.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Duplicate transaction code", duplicate: duplicate.rows[0] });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contributorName = coalescePersonName(normalizedDisplayName, displayName) || "Cash Contributor";
    const saved = await recordContribution(client, {
      campaignId,
      contributorId: contributorId || undefined,
      displayName: normalizedDisplayName || undefined,
      identityType,
      formalName: contributorName,
      senderName: contributorName,
      amount: numericAmount,
      transactionCode,
      rawText: typeof note === "string" && note.trim() ? `Manual cash contribution: ${note.trim()}` : "Manual cash contribution",
      source: "manual",
      timestamp: typeof eventTime === "string" && eventTime.trim() ? eventTime.trim() : new Date().toISOString(),
    });

    await client.query("COMMIT");

    const whatsappSummary = await generateWhatsappSummary(campaignId);

    return res.status(201).json({
      status: "saved",
      contributor: saved.contributor,
      transaction: saved.transaction,
      whatsappSummary,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Failed to save manual contribution";
    return res.status(422).json({ error: message });
  } finally {
    client.release();
  }
});

transactionsRouter.get("/:campaignId", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const result = await pool.query(
    "SELECT * FROM transactions WHERE campaign_id = $1 ORDER BY created_at DESC",
    [req.params.campaignId]
  );
  return res.json(result.rows);
});

transactionsRouter.delete("/:transactionId", requireRole("admin", "treasurer"), async (req, res) => {
  const { currentPassword } = req.body;
  const user = getRequestUser(req);

  if (!currentPassword) {
    return res.status(400).json({ error: "currentPassword is required" });
  }

  const userResult = await pool.query("SELECT password_hash FROM users WHERE id = $1", [user.id]);
  if ((userResult.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "User not found" });
  }

  const passwordValid = await bcrypt.compare(String(currentPassword), userResult.rows[0].password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const transactionResult = await client.query(
      `
      SELECT t.id, t.amount, t.campaign_id, t.contributor_id
      FROM transactions t
      WHERE t.id = $1
      FOR UPDATE
      `,
      [req.params.transactionId]
    );

    if ((transactionResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found" });
    }

    const transaction = transactionResult.rows[0];
    const accessibleCampaign = await getAccessibleCampaign(user, transaction.campaign_id, client);
    if (!accessibleCampaign) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Transaction not found" });
    }

    await client.query("DELETE FROM transactions WHERE id = $1", [req.params.transactionId]);
    await client.query(
      "UPDATE contributors SET total_contributed = GREATEST(total_contributed - $2, 0) WHERE id = $1",
      [transaction.contributor_id, transaction.amount]
    );
    await client.query(
      "UPDATE campaigns SET total_raised = GREATEST(total_raised - $2, 0) WHERE id = $1",
      [transaction.campaign_id, transaction.amount]
    );

    await client.query("COMMIT");
    return res.json({ deleted: true, id: req.params.transactionId, campaignId: transaction.campaign_id });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Failed to delete transaction";
    return res.status(422).json({ error: message });
  } finally {
    client.release();
  }
});

export { transactionsRouter };
