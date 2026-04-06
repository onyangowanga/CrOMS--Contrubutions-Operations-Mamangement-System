import { PoolClient } from "pg";
import { coalescePersonName, normalizePersonName } from "../utils/names";

interface RecordContributionInput {
  campaignId: string;
  contributorId?: string;
  displayName?: string;
  identityType?: string;
  formalName: string;
  senderName: string;
  amount: number;
  transactionCode: string;
  rawText: string;
  source: "mpesa" | "bank" | "manual";
  timestamp: string;
}

export async function recordContribution(
  client: PoolClient,
  input: RecordContributionInput
): Promise<{ contributor: any; transaction: any }> {
  const normalizedDisplayName = normalizePersonName(input.displayName);
  const normalizedFormalName = coalescePersonName(input.formalName, input.senderName) || input.senderName.trim();
  const normalizedSenderName = coalescePersonName(input.senderName, input.formalName) || input.senderName.trim();
  let contributor;

  if (input.contributorId) {
    const contributorResult = await client.query("SELECT * FROM contributors WHERE id = $1", [input.contributorId]);
    if ((contributorResult.rowCount ?? 0) === 0) {
      throw new Error("Contributor not found");
    }

    contributor = contributorResult.rows[0];
    const alternateSenders = Array.isArray(contributor.alternate_senders) ? contributor.alternate_senders : [];
    const mergedSenders = alternateSenders.includes(normalizedSenderName)
      ? alternateSenders
      : [...alternateSenders, normalizedSenderName];

    const nextFormalName = coalescePersonName(contributor.formal_name, normalizedFormalName, normalizedSenderName) || normalizedSenderName;
    const nextDisplayName = coalescePersonName(
      normalizedDisplayName,
      contributor.display_name,
      contributor.formal_name,
      normalizedFormalName,
      normalizedSenderName
    ) || normalizedSenderName;

    const updated = await client.query(
      `
      UPDATE contributors
      SET formal_name = $2,
          display_name = $3,
          identity_type = COALESCE($4::identity_type, identity_type),
          alternate_senders = $5::jsonb
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contributorId,
        nextFormalName,
        nextDisplayName,
        input.identityType ?? null,
        JSON.stringify(mergedSenders),
      ]
    );

    contributor = updated.rows[0];
  } else {
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
        input.campaignId,
        normalizedFormalName,
        normalizedDisplayName || normalizedSenderName,
        input.identityType ?? "individual",
        JSON.stringify([normalizedSenderName]),
      ]
    );

    contributor = createdContributor.rows[0];
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
      input.campaignId,
      contributor.id,
      input.amount,
      input.transactionCode,
      input.rawText,
      input.source,
      normalizedSenderName,
      input.timestamp,
    ]
  );

  await client.query(
    "UPDATE contributors SET total_contributed = total_contributed + $2 WHERE id = $1",
    [contributor.id, input.amount]
  );

  await client.query(
    "UPDATE campaigns SET total_raised = total_raised + $2 WHERE id = $1",
    [input.campaignId, input.amount]
  );

  return {
    contributor,
    transaction: transactionResult.rows[0],
  };
}
