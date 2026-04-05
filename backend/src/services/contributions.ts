import { PoolClient } from "pg";

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
  let contributor;

  if (input.contributorId) {
    const contributorResult = await client.query("SELECT * FROM contributors WHERE id = $1", [input.contributorId]);
    if ((contributorResult.rowCount ?? 0) === 0) {
      throw new Error("Contributor not found");
    }

    contributor = contributorResult.rows[0];
    const alternateSenders = Array.isArray(contributor.alternate_senders) ? contributor.alternate_senders : [];
    const mergedSenders = alternateSenders.includes(input.senderName)
      ? alternateSenders
      : [...alternateSenders, input.senderName];

    const updated = await client.query(
      `
      UPDATE contributors
      SET display_name = COALESCE($2, display_name),
          identity_type = COALESCE($3::identity_type, identity_type),
          alternate_senders = $4::jsonb
      WHERE id = $1
      RETURNING *
      `,
      [
        input.contributorId,
        input.displayName ?? null,
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
        input.formalName,
        input.displayName ?? input.senderName,
        input.identityType ?? "individual",
        JSON.stringify([input.senderName]),
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
      input.senderName,
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
