import { Request, Response } from "express";
import { findBestContributorMatch } from "../../lib/nameMatching";
import { pool } from "../../db/client";
import { getAccessibleCampaign } from "../../lib/access";
import { postAllocatedContribution, previewContributionAllocations } from "../../services/payments";
import { generateWhatsappSummary } from "../../services/summary";
import { normalizePersonName } from "../../utils/names";
import { parseTransactionText } from "../../utils/parser";

function firstScalar(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    const first = value.find((entry) => typeof entry === "string" && entry.trim());
    return typeof first === "string" ? first.trim() : undefined;
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function handleParsedTransaction(req: Request, res: Response): Promise<Response> {
  const campaignId = firstScalar(req.body.campaignId);
  const priorityCampaignId = firstScalar(req.body.priorityCampaignId);
  const rawText = firstScalar(req.body.rawText);
  const displayName = firstScalar(req.body.displayName);
  const identityType = firstScalar(req.body.identityType);
  const allocations = Array.isArray(req.body.allocations) ? req.body.allocations : undefined;
  const normalizedDisplayName = normalizePersonName(displayName);

  if (!campaignId || !rawText) {
    return res.status(400).json({ error: "campaignId and rawText are required" });
  }

  const authedUser = (req as any).user;
  const accessibleCampaign = await getAccessibleCampaign(authedUser, campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  if (priorityCampaignId) {
    const accessiblePriorityCampaign = await getAccessibleCampaign(authedUser, priorityCampaignId);
    if (!accessiblePriorityCampaign) {
      return res.status(404).json({ error: "Priority campaign not found" });
    }
  }

  const campaign = await pool.query("SELECT id FROM campaigns WHERE id = $1", [campaignId]);
  if ((campaign.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  try {
    const parsed = parseTransactionText(rawText, normalizedDisplayName || displayName);

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

      const matchingName = normalizedDisplayName || parsed.senderName;
      const match = findBestContributorMatch(matchingName, contributors.rows as Array<any>);
      const allocationPreview = await previewContributionAllocations({
        campaignId,
        priorityCampaignId,
        contributorId: match.contributor?.id,
        displayName: matchingName,
        identityType,
        totalAmount: parsed.amount,
      }, client);
      const finalAllocations = Array.isArray(allocations) && allocations.length > 0 ? allocations : allocationPreview.allocations
        .filter((item) => Number(item.suggestedAmount) > 0)
        .map((item) => ({ campaignId: item.campaignId, amount: Number(item.suggestedAmount) }));

      if (!match.exact && !normalizedDisplayName) {
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
            allocation_plan,
            match_score,
            review_reason,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::source_type, $8, $9, $10::identity_type, $11::jsonb, $12, $13, 'pending')
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
            normalizedDisplayName || parsed.senderName,
            identityType ?? "individual",
            JSON.stringify({
              priorityCampaignId: priorityCampaignId || campaignId,
              allocations: finalAllocations,
            }),
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

      const saved = await postAllocatedContribution(client, {
        campaignId,
        priorityCampaignId: priorityCampaignId || undefined,
        contributorId: match.exact ? match.contributor?.id : undefined,
        displayName: normalizedDisplayName || undefined,
        identityType,
        formalName: normalizedDisplayName || parsed.senderName,
        senderName: normalizedDisplayName || parsed.senderName,
        totalAmount: parsed.amount,
        allocations: finalAllocations,
        referenceCode: parsed.transactionCode,
        rawText,
        source: parsed.source,
        timestamp: parsed.timestamp,
        createdBy: authedUser?.id,
      });

      await client.query("COMMIT");

      const whatsappSummary = await generateWhatsappSummary(campaignId);

      return res.status(201).json({
        status: "saved",
        parsed,
        payment: saved.payment,
        memberProfile: saved.memberProfile,
        allocations: saved.transactions,
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
