import { PoolClient } from "pg";
import { pool } from "../db/client";
import { findBestContributorMatch } from "../lib/nameMatching";
import { coalescePersonName, normalizePersonName } from "../utils/names";

type Queryable = Pick<PoolClient, "query"> | typeof pool;

export interface AllocationInput {
  campaignId: string;
  amount: number;
}

interface PaymentPreviewInput {
  campaignId: string;
  priorityCampaignId?: string;
  contributorId?: string;
  displayName?: string;
  identityType?: string;
  totalAmount: number;
}

interface PostedPaymentInput {
  campaignId: string;
  priorityCampaignId?: string;
  contributorId?: string;
  displayName?: string;
  identityType?: string;
  formalName: string;
  senderName: string;
  totalAmount: number;
  referenceCode: string;
  rawText: string;
  source: "mpesa" | "bank" | "manual";
  timestamp: string;
  createdBy?: string;
  allocations?: AllocationInput[];
}

interface MemberProfileRow {
  id: string;
  group_id: string;
  formal_name: string;
  display_name: string;
  identity_type: string;
  alternate_senders: string[] | null;
}

interface ContributorRow {
  id: string;
  campaign_id: string;
  member_profile_id: string | null;
  formal_name: string;
  display_name: string;
  identity_type: string;
  alternate_senders: string[] | null;
  total_contributed?: string | number;
}

interface CampaignPreviewRow {
  campaignId: string;
  campaignName: string;
  fixedContributionAmount: number | null;
  alreadyContributed: number;
  outstandingAmount: number | null;
  suggestedAmount: number;
}

export async function previewContributionAllocations(input: PaymentPreviewInput, client: Queryable = pool) {
  const baseCampaign = await client.query(
    "SELECT id, group_id FROM campaigns WHERE id = $1",
    [input.campaignId]
  );

  if ((baseCampaign.rowCount ?? 0) === 0) {
    throw new Error("Campaign not found");
  }

  const groupId = baseCampaign.rows[0].group_id as string;
  const priorityCampaignId = input.priorityCampaignId || input.campaignId;
  const contributor = input.contributorId
    ? await client.query(
        `
        SELECT c.id, c.campaign_id, c.member_profile_id, c.formal_name, c.display_name, c.identity_type, c.alternate_senders
        FROM contributors c
        JOIN campaigns campaign_access ON campaign_access.id = c.campaign_id
        WHERE c.id = $1 AND campaign_access.group_id = $2
        `,
        [input.contributorId, groupId]
      )
    : null;

  if (input.contributorId && ((contributor?.rowCount ?? 0) === 0)) {
    throw new Error("Contributor not found");
  }

  const previewName =
    coalescePersonName(input.displayName, contributor?.rows[0]?.display_name, contributor?.rows[0]?.formal_name) ||
    normalizePersonName(input.displayName) ||
    "Contributor";

  const memberProfile = await findExistingMemberProfile(
    groupId,
    previewName,
    contributor?.rows[0]?.member_profile_id || null,
    client
  );

  const campaignRows = await client.query(
    `
    SELECT c.id, c.name, c.created_at, c.fixed_contribution_amount,
           contrib.id AS contributor_id, contrib.member_profile_id, contrib.display_name, contrib.formal_name, contrib.total_contributed
    FROM campaigns c
    LEFT JOIN contributors contrib ON contrib.campaign_id = c.id
    WHERE c.group_id = $1 AND c.status = 'active'
    ORDER BY c.created_at ASC
    `,
    [groupId]
  );

  const campaigns = new Map<string, CampaignPreviewRow>();
  for (const row of campaignRows.rows) {
    const existing = campaigns.get(row.id) || {
      campaignId: row.id,
      campaignName: row.name,
      fixedContributionAmount: row.fixed_contribution_amount === null ? null : Number(row.fixed_contribution_amount),
      alreadyContributed: 0,
      outstandingAmount: null,
      suggestedAmount: 0,
    };

    if (row.contributor_id && contributorBelongsToPreview(row, memberProfile, previewName)) {
      existing.alreadyContributed += Number(row.total_contributed || 0);
    }

    campaigns.set(row.id, existing);
  }

  const ordered = Array.from(campaigns.values())
    .map((campaign) => ({
      ...campaign,
      outstandingAmount:
        campaign.fixedContributionAmount === null
          ? null
          : Math.max(campaign.fixedContributionAmount - campaign.alreadyContributed, 0),
    }))
    .sort((left, right) => {
      if (left.campaignId === priorityCampaignId) {
        return -1;
      }
      if (right.campaignId === priorityCampaignId) {
        return 1;
      }
      return left.campaignName.localeCompare(right.campaignName);
    });

  let remaining = Number(input.totalAmount || 0);
  const allocations = ordered.map((campaign) => {
    let suggestedAmount = 0;
    if (campaign.outstandingAmount !== null && campaign.outstandingAmount > 0 && remaining > 0) {
      suggestedAmount = Math.min(remaining, campaign.outstandingAmount);
      remaining -= suggestedAmount;
    }

    return {
      ...campaign,
      suggestedAmount,
    };
  });

  if (remaining > 0) {
    const priority = allocations.find((campaign) => campaign.campaignId === priorityCampaignId) || allocations[0];
    if (priority) {
      priority.suggestedAmount += remaining;
      remaining = 0;
    }
  }

  return {
    groupId,
    priorityCampaignId,
    totalAmount: Number(input.totalAmount || 0),
    unallocatedAmount: remaining,
    member: {
      id: memberProfile?.id ?? null,
      displayName: memberProfile?.display_name || previewName,
      formalName: memberProfile?.formal_name || previewName,
      identityType:
        input.identityType || memberProfile?.identity_type || contributor?.rows[0]?.identity_type || "individual",
    },
    allocations,
  };
}

export async function postAllocatedContribution(client: PoolClient, input: PostedPaymentInput) {
  const baseCampaign = await client.query(
    "SELECT id, group_id FROM campaigns WHERE id = $1",
    [input.campaignId]
  );

  if ((baseCampaign.rowCount ?? 0) === 0) {
    throw new Error("Campaign not found");
  }

  const groupId = baseCampaign.rows[0].group_id as string;
  const normalizedDisplayName = normalizePersonName(input.displayName);
  const normalizedFormalName = coalescePersonName(input.formalName, input.senderName, normalizedDisplayName) || input.senderName.trim();
  const normalizedSenderName = coalescePersonName(input.senderName, input.formalName, normalizedDisplayName) || input.senderName.trim();
  const allocationInputs = normalizeAllocationInputs(
    input.allocations,
    input.priorityCampaignId || input.campaignId,
    Number(input.totalAmount || 0)
  );

  const campaigns = await client.query(
    "SELECT id, group_id FROM campaigns WHERE id = ANY($1::uuid[])",
    [allocationInputs.map((allocation) => allocation.campaignId)]
  );

  if ((campaigns.rowCount ?? 0) !== allocationInputs.length || campaigns.rows.some((row) => row.group_id !== groupId)) {
    throw new Error("All allocations must belong to the same group");
  }

  const memberProfile = await resolveMemberProfile(client, {
    groupId,
    contributorId: input.contributorId,
    displayName: normalizedDisplayName || undefined,
    formalName: normalizedFormalName,
    senderName: normalizedSenderName,
    identityType: input.identityType,
  });

  const payment = await client.query(
    `
    INSERT INTO payments (
      group_id,
      member_profile_id,
      total_amount,
      reference_code,
      message_raw,
      source,
      sender_name,
      event_time,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6::source_type, $7, $8, $9)
    RETURNING *
    `,
    [
      groupId,
      memberProfile.id,
      Number(input.totalAmount || 0),
      input.referenceCode,
      input.rawText,
      input.source,
      normalizedSenderName,
      input.timestamp,
      input.createdBy ?? null,
    ]
  );

  const contributors = [] as Array<any>;
  const transactions = [] as Array<any>;

  for (let index = 0; index < allocationInputs.length; index += 1) {
    const allocation = allocationInputs[index];
    const contributor = await ensureContributorForCampaign(client, {
      campaignId: allocation.campaignId,
      contributorId: allocation.campaignId === input.campaignId ? input.contributorId : undefined,
      memberProfile,
      displayName: normalizedDisplayName || memberProfile.display_name,
      formalName: normalizedFormalName,
      identityType: input.identityType,
      senderName: normalizedSenderName,
    });

    const transactionCode =
      allocationInputs.length === 1
        ? input.referenceCode
        : `${input.referenceCode}-${String(index + 1).padStart(2, "0")}`;

    const transaction = await client.query(
      `
      INSERT INTO transactions (
        payment_id,
        campaign_id,
        contributor_id,
        amount,
        transaction_code,
        message_raw,
        source,
        sender_name,
        event_time
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::source_type, $8, $9)
      RETURNING *
      `,
      [
        payment.rows[0].id,
        allocation.campaignId,
        contributor.id,
        allocation.amount,
        transactionCode,
        input.rawText,
        input.source,
        normalizedSenderName,
        input.timestamp,
      ]
    );

    await client.query(
      "UPDATE contributors SET total_contributed = total_contributed + $2 WHERE id = $1",
      [contributor.id, allocation.amount]
    );
    await client.query(
      "UPDATE campaigns SET total_raised = total_raised + $2 WHERE id = $1",
      [allocation.campaignId, allocation.amount]
    );

    contributors.push(contributor);
    transactions.push(transaction.rows[0]);
  }

  return {
    payment: payment.rows[0],
    memberProfile,
    contributors,
    transactions,
    contributor: contributors[0],
    transaction: transactions[0],
  };
}

function normalizeAllocationInputs(allocations: AllocationInput[] | undefined, fallbackCampaignId: string, totalAmount: number) {
  const rawAllocations = Array.isArray(allocations) && allocations.length > 0 ? allocations : [{ campaignId: fallbackCampaignId, amount: totalAmount }];
  const normalized = rawAllocations
    .map((allocation) => ({
      campaignId: String(allocation.campaignId),
      amount: Number(allocation.amount || 0),
    }))
    .filter((allocation) => allocation.campaignId && allocation.amount > 0);

  if (normalized.length === 0) {
    throw new Error("At least one allocation amount is required");
  }

  const totalAllocated = normalized.reduce((sum, allocation) => sum + allocation.amount, 0);
  if (Math.abs(totalAllocated - totalAmount) > 0.009) {
    throw new Error("Allocation amounts must add up to the received total");
  }

  return normalized;
}

async function findExistingMemberProfile(groupId: string, previewName: string, memberProfileId: string | null, client: Queryable) {
  if (memberProfileId) {
    const byId = await client.query("SELECT * FROM member_profiles WHERE id = $1 AND group_id = $2", [memberProfileId, groupId]);
    if ((byId.rowCount ?? 0) > 0) {
      return byId.rows[0] as MemberProfileRow;
    }
  }

  const profiles = await client.query(
    "SELECT id, group_id, formal_name, display_name, identity_type, alternate_senders FROM member_profiles WHERE group_id = $1",
    [groupId]
  );
  const match = findBestContributorMatch(previewName, profiles.rows as Array<any>);
  return match.exact ? (match.contributor as MemberProfileRow) : null;
}

async function resolveMemberProfile(
  client: PoolClient,
  input: {
    groupId: string;
    contributorId?: string;
    displayName?: string;
    formalName: string;
    senderName: string;
    identityType?: string;
  }
) {
  if (input.contributorId) {
    const contributor = await client.query(
      `
      SELECT c.*, campaign_access.group_id
      FROM contributors c
      JOIN campaigns campaign_access ON campaign_access.id = c.campaign_id
      WHERE c.id = $1 AND campaign_access.group_id = $2
      `,
      [input.contributorId, input.groupId]
    );

    if ((contributor.rowCount ?? 0) > 0) {
      const row = contributor.rows[0] as ContributorRow;
      if (row.member_profile_id) {
        const existing = await client.query("SELECT * FROM member_profiles WHERE id = $1", [row.member_profile_id]);
        if ((existing.rowCount ?? 0) > 0) {
          return updateMemberProfile(client, existing.rows[0] as MemberProfileRow, input);
        }
      }

      const created = await createMemberProfile(client, {
        groupId: input.groupId,
        displayName: input.displayName || row.display_name,
        formalName: input.formalName || row.formal_name,
        identityType: input.identityType || row.identity_type,
        senderName: input.senderName,
      });

      await client.query(
        "UPDATE contributors SET member_profile_id = $2, canonical_id = $2 WHERE id = $1",
        [row.id, created.id]
      );

      return created;
    }
  }

  const previewName = coalescePersonName(input.displayName, input.formalName, input.senderName) || input.senderName;
  const existing = await findExistingMemberProfile(input.groupId, previewName, null, client);
  if (existing) {
    return updateMemberProfile(client, existing, input);
  }

  return createMemberProfile(client, {
    groupId: input.groupId,
    displayName: input.displayName || previewName,
    formalName: input.formalName,
    identityType: input.identityType || "individual",
    senderName: input.senderName,
  });
}

async function createMemberProfile(
  client: PoolClient,
  input: { groupId: string; displayName: string; formalName: string; identityType: string; senderName: string }
) {
  const profile = await client.query(
    `
    INSERT INTO member_profiles (group_id, formal_name, display_name, identity_type, alternate_senders)
    VALUES ($1, $2, $3, $4::identity_type, $5::jsonb)
    RETURNING *
    `,
    [
      input.groupId,
      coalescePersonName(input.formalName, input.senderName, input.displayName) || input.displayName,
      coalescePersonName(input.displayName, input.formalName, input.senderName) || input.formalName,
      input.identityType,
      JSON.stringify([coalescePersonName(input.senderName, input.formalName, input.displayName) || input.displayName]),
    ]
  );

  return profile.rows[0] as MemberProfileRow;
}

async function updateMemberProfile(
  client: PoolClient,
  profile: MemberProfileRow,
  input: { displayName?: string; formalName: string; senderName: string; identityType?: string }
) {
  const mergedSenders = new Set(Array.isArray(profile.alternate_senders) ? profile.alternate_senders : []);
  const resolvedSender = coalescePersonName(input.senderName, input.formalName, input.displayName) || input.formalName;
  mergedSenders.add(resolvedSender);

  const updated = await client.query(
    `
    UPDATE member_profiles
    SET formal_name = $2,
        display_name = $3,
        identity_type = COALESCE($4::identity_type, identity_type),
        alternate_senders = $5::jsonb
    WHERE id = $1
    RETURNING *
    `,
    [
      profile.id,
      coalescePersonName(profile.formal_name, input.formalName, resolvedSender) || resolvedSender,
      coalescePersonName(input.displayName, profile.display_name, profile.formal_name, resolvedSender) || resolvedSender,
      input.identityType ?? null,
      JSON.stringify(Array.from(mergedSenders)),
    ]
  );

  return updated.rows[0] as MemberProfileRow;
}

async function ensureContributorForCampaign(
  client: PoolClient,
  input: {
    campaignId: string;
    contributorId?: string;
    memberProfile: MemberProfileRow;
    displayName: string;
    formalName: string;
    identityType?: string;
    senderName: string;
  }
) {
  if (input.contributorId) {
    const existingById = await client.query(
      "SELECT * FROM contributors WHERE id = $1 AND campaign_id = $2",
      [input.contributorId, input.campaignId]
    );
    if ((existingById.rowCount ?? 0) > 0) {
      const updated = await client.query(
        `
        UPDATE contributors
        SET member_profile_id = $2,
            formal_name = $3,
            display_name = $4,
            identity_type = COALESCE($5::identity_type, identity_type),
            alternate_senders = $6::jsonb,
            canonical_id = $2
        WHERE id = $1
        RETURNING *
        `,
        [
          input.contributorId,
          input.memberProfile.id,
          coalescePersonName(input.formalName, input.memberProfile.formal_name, input.senderName) || input.senderName,
          coalescePersonName(input.displayName, input.memberProfile.display_name, input.senderName) || input.senderName,
          input.identityType ?? null,
          JSON.stringify(input.memberProfile.alternate_senders || [input.senderName]),
        ]
      );
      return updated.rows[0];
    }
  }

  const existing = await client.query(
    "SELECT * FROM contributors WHERE campaign_id = $1 AND member_profile_id = $2",
    [input.campaignId, input.memberProfile.id]
  );

  if ((existing.rowCount ?? 0) > 0) {
    const contributor = existing.rows[0] as ContributorRow;
    const mergedSenders = new Set(Array.isArray(contributor.alternate_senders) ? contributor.alternate_senders : []);
    mergedSenders.add(coalescePersonName(input.senderName, input.formalName, input.displayName) || input.displayName);
    const updated = await client.query(
      `
      UPDATE contributors
      SET formal_name = $2,
          display_name = $3,
          identity_type = COALESCE($4::identity_type, identity_type),
          alternate_senders = $5::jsonb,
          canonical_id = $6
      WHERE id = $1
      RETURNING *
      `,
      [
        contributor.id,
        coalescePersonName(contributor.formal_name, input.formalName, input.memberProfile.formal_name) || input.memberProfile.formal_name,
        coalescePersonName(input.displayName, contributor.display_name, input.memberProfile.display_name) || input.memberProfile.display_name,
        input.identityType ?? null,
        JSON.stringify(Array.from(mergedSenders)),
        input.memberProfile.id,
      ]
    );
    return updated.rows[0];
  }

  const created = await client.query(
    `
    INSERT INTO contributors (
      campaign_id,
      member_profile_id,
      formal_name,
      display_name,
      identity_type,
      alternate_senders,
      canonical_id
    )
    VALUES ($1, $2, $3, $4, $5::identity_type, $6::jsonb, $2)
    RETURNING *
    `,
    [
      input.campaignId,
      input.memberProfile.id,
      coalescePersonName(input.formalName, input.memberProfile.formal_name, input.senderName) || input.senderName,
      coalescePersonName(input.displayName, input.memberProfile.display_name, input.senderName) || input.senderName,
      input.identityType || input.memberProfile.identity_type || "individual",
      JSON.stringify(input.memberProfile.alternate_senders || [input.senderName]),
    ]
  );

  return created.rows[0];
}

function contributorBelongsToPreview(row: any, memberProfile: MemberProfileRow | null, previewName: string) {
  if (memberProfile?.id && row.member_profile_id === memberProfile.id) {
    return true;
  }

  const normalizedPreview = normalizePersonName(previewName);
  return normalizedPreview !== null && (
    normalizePersonName(row.display_name) === normalizedPreview ||
    normalizePersonName(row.formal_name) === normalizedPreview
  );
}
