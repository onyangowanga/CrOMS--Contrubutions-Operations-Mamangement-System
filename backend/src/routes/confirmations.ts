import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, requireRole, AuthedRequest } from "../middleware/auth";
import { recordContribution } from "../services/contributions";
import { generateWhatsappSummary } from "../services/summary";

const confirmationsRouter = Router();
confirmationsRouter.use(requireAuth);

confirmationsRouter.get("/", async (req, res) => {
  const status = String(req.query.status ?? "pending");
  const campaignId = req.query.campaignId ? String(req.query.campaignId) : null;

  const values: unknown[] = [status];
  let query = `
    SELECT cq.*, c.display_name AS suggested_display_name, c.identity_type AS suggested_identity_type
    FROM confirmation_queue cq
    LEFT JOIN contributors c ON c.id = cq.suggested_contributor_id
    WHERE cq.status = $1::confirmation_status
  `;

  if (campaignId) {
    values.push(campaignId);
    query += ` AND cq.campaign_id = $${values.length}`;
  }

  query += " ORDER BY cq.created_at DESC";
  const result = await pool.query(query, values);
  return res.json(result.rows);
});

confirmationsRouter.post("/:id/approve", requireRole("admin", "treasurer"), async (req, res) => {
  const { contributorId, displayName, identityType } = req.body;
  const user = (req as AuthedRequest).user;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const queueResult = await client.query(
      "SELECT * FROM confirmation_queue WHERE id = $1 AND status = 'pending' FOR UPDATE",
      [req.params.id]
    );

    if ((queueResult.rowCount ?? 0) === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Pending confirmation not found" });
    }

    const item = queueResult.rows[0];
    const duplicate = await client.query(
      "SELECT id FROM transactions WHERE transaction_code = $1",
      [item.parsed_transaction_code]
    );

    if ((duplicate.rowCount ?? 0) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Transaction already recorded" });
    }

    const finalContributorId = contributorId || item.suggested_contributor_id || undefined;
    const finalDisplayName = displayName || item.proposed_display_name || item.parsed_sender_name;
    const finalIdentityType = identityType || item.proposed_identity_type || "individual";

    const saved = await recordContribution(client, {
      campaignId: item.campaign_id,
      contributorId: finalContributorId,
      displayName: finalDisplayName,
      identityType: finalIdentityType,
      formalName: item.parsed_sender_name,
      senderName: item.parsed_sender_name,
      amount: Number(item.parsed_amount),
      transactionCode: item.parsed_transaction_code,
      rawText: item.raw_text,
      source: item.parsed_source,
      timestamp: item.parsed_timestamp,
    });

    const updatedQueue = await client.query(
      `
      UPDATE confirmation_queue
      SET status = 'approved',
          reviewed_by = $2,
          reviewed_at = NOW(),
          suggested_contributor_id = $3,
          proposed_display_name = $4,
          proposed_identity_type = $5::identity_type
      WHERE id = $1
      RETURNING *
      `,
      [req.params.id, user.id, saved.contributor.id, finalDisplayName, finalIdentityType]
    );

    await client.query("COMMIT");

    const whatsappSummary = await generateWhatsappSummary(item.campaign_id);
    return res.json({
      confirmation: updatedQueue.rows[0],
      contributor: saved.contributor,
      transaction: saved.transaction,
      whatsappSummary,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Failed to approve confirmation";
    return res.status(422).json({ error: message });
  } finally {
    client.release();
  }
});

confirmationsRouter.post("/:id/reject", requireRole("admin", "treasurer"), async (req, res) => {
  const { reason } = req.body;
  const user = (req as AuthedRequest).user;
  const updated = await pool.query(
    `
    UPDATE confirmation_queue
    SET status = 'rejected',
        reviewed_by = $2,
        reviewed_at = NOW(),
        review_reason = COALESCE($3, review_reason)
    WHERE id = $1 AND status = 'pending'
    RETURNING *
    `,
    [req.params.id, user.id, reason ?? null]
  );

  if ((updated.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Pending confirmation not found" });
  }

  return res.json({ confirmation: updated.rows[0] });
});

export { confirmationsRouter };
