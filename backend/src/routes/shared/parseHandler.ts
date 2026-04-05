import { Request, Response } from "express";
import { pool } from "../../db/client";
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
      "SELECT id, transaction_code FROM transactions WHERE transaction_code = $1",
      [parsed.transactionCode]
    );
    if ((duplicate.rowCount ?? 0) > 0) {
      return res.status(409).json({ error: "Duplicate transaction code", duplicate: duplicate.rows[0] });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingContributor = await client.query(
        `
        SELECT *
        FROM contributors
        WHERE campaign_id = $1
          AND (
            lower(formal_name) = lower($2)
            OR lower(display_name) = lower($2)
            OR alternate_senders @> to_jsonb(ARRAY[$2]::text[])
          )
        LIMIT 1
        `,
        [campaignId, parsed.senderName]
      );

      let contributor = existingContributor.rows[0];

      if (!contributor) {
        const createdContributor = await client.query(
          `
          INSERT INTO contributors (
            campaign_id,
            formal_name,
            display_name,
            identity_type,
            alternate_senders,
            canonical_id
          )
          VALUES ($1, $2, $3, $4::identity_type, $5::jsonb, gen_random_uuid())
          RETURNING *
          `,
          [
            campaignId,
            parsed.senderName,
            displayName ?? parsed.senderName,
            identityType ?? "individual",
            JSON.stringify([parsed.senderName]),
          ]
        );

        contributor = createdContributor.rows[0];
      } else {
        const senderList = Array.isArray(contributor.alternate_senders)
          ? contributor.alternate_senders
          : [];
        const mergedSenders = senderList.includes(parsed.senderName)
          ? senderList
          : [...senderList, parsed.senderName];

        const updatedContributor = await client.query(
          "UPDATE contributors SET alternate_senders = $2::jsonb WHERE id = $1 RETURNING *",
          [contributor.id, JSON.stringify(mergedSenders)]
        );

        contributor = updatedContributor.rows[0];
      }

      const transactionResult = await client.query(
        `
        INSERT INTO transactions (
          campaign_id,
          contributor_id,
          amount,
          transaction_code,
          message_raw,
          source,
          sender_name,
          event_time
        )
        VALUES ($1, $2, $3, $4, $5, $6::source_type, $7, $8)
        RETURNING *
        `,
        [
          campaignId,
          contributor.id,
          parsed.amount,
          parsed.transactionCode,
          rawText,
          parsed.source,
          parsed.senderName,
          parsed.timestamp,
        ]
      );

      await client.query(
        "UPDATE contributors SET total_contributed = total_contributed + $2 WHERE id = $1",
        [contributor.id, parsed.amount]
      );

      await client.query(
        "UPDATE campaigns SET total_raised = total_raised + $2 WHERE id = $1",
        [campaignId, parsed.amount]
      );

      await client.query("COMMIT");

      const whatsappSummary = await generateWhatsappSummary(campaignId);

      return res.status(201).json({
        parsed,
        contributor,
        transaction: transactionResult.rows[0],
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
