import { Request, Response } from "express";
import { findBestContributorMatch } from "../../lib/nameMatching";
import { pool } from "../../db/client";
import { recordContribution } from "../../services/contributions";
import { generateWhatsappSummary } from "../../services/summary";
import { parseTransactionText } from "../../utils/parser";

export async function handleParsedTransaction(req: Request, res: Response): Promise<Response> {
  const { campaignId, rawText, displayName, identityType } = req.body;

  if (!campaignId || !rawText) {
    return res.status(400).json({ error: "campaignId and rawText are required" });
  }

  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [campaignId]);
  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  try {
    const parsed = parseTransactionText(rawText);

    const duplicate = await pool.query(
      `
      SELECT id, transaction_code AS reference_code, 'transaction' AS source_table
      FROM transactions
      WHERE transaction_code = $1
      UNION ALL
      SELECT id, parsed_transaction_code AS reference_code, 'confirmation_queue' AS source_table
      FROM confirmation_queue
      WHERE parsed_transaction_code = $1 AND status = 'pending'
      `,
      [parsed.transactionCode]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "Duplicate transaction code", duplicate: duplicate.rows[0] });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const contributors = await client.query(
        "SELECT id, formal_name, display_name, alternate_senders FROM contributors WHERE campaign_id = $1",
        [campaignId]
      );

      const match = findBestContributorMatch(parsed.senderName, contributors.rows as Array<any>);

      if (!match.exact) {
        const reviewReason = match.contributor
          ? "Potential contributor match found. Treasurer confirmation required."
          : "No exact contributor match found. Treasurer confirmation required.";

        const queued = await client.query(
          `
          INSERT INTO confirmation_queue (
            campaign_id,
            suggested_contributor_id,
            parsed_amount,
            parsed_sender_name,
            parsed_transaction_code,
            parsed_timestamp,
            parsed_source,
            raw_text,
            proposed_display_name,
            proposed_identity_type,
            match_score,
            review_reason,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::source_type, $8, $9, $10::identity_type, $11, $12, 'pending')
          RETURNING *
          `,
          [
            campaignId,
            match.contributor?.id ?? null,
            parsed.amount,
            parsed.senderName,
            parsed.transactionCode,
            parsed.timestamp,
            parsed.source,
            rawText,
            displayName ?? parsed.senderName,
            identityType ?? "individual",
            match.score || null,
            reviewReason,
          ]
        );

        await client.query("COMMIT");

        return res.status(202).json({
          status: "queued",
          confirmation: queued.rows[0],
          suggestedContributor: match.contributor,
          message: reviewReason,
        });
      }

      const saved = await recordContribution(client, {
        campaignId,
        contributorId: match.contributor?.id,
        displayName,
        identityType,
        formalName: parsed.senderName,
        senderName: parsed.senderName,
        amount: parsed.amount,
        transactionCode: parsed.transactionCode,
        rawText,
        source: parsed.source,
        timestamp: parsed.timestamp,
      });

      await client.query("COMMIT");

      const whatsappSummary = await generateWhatsappSummary(campaignId);

      return res.status(201).json({
        status: "saved",
        parsed,
        contributor: saved.contributor,
        transaction: saved.transaction,
        whatsappSummary,
      });
    } catch (txError) {
      await client.query("ROLLBACK");
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse transaction";
    return res.status(422).json({ error: message });
  }
}
