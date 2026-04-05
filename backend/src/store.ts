import { v4 as uuidv4 } from "uuid";
import {
  Campaign,
  CampaignStatus,
  Contributor,
  IdentityType,
  PaymentMethod,
  PaymentMethodType,
  Transaction,
} from "./types";

const campaigns = new Map<string, Campaign>();
const contributors = new Map<string, Contributor>();
const transactions = new Map<string, Transaction>();
const paymentMethods = new Map<string, PaymentMethod>();

export const db = {
  listCampaigns(): Campaign[] {
    return Array.from(campaigns.values());
  },

  createCampaign(input: {
    name: string;
    groupId: string;
    targetAmount?: number;
    status?: CampaignStatus;
  }): Campaign {
    const campaign: Campaign = {
      id: uuidv4(),
      name: input.name,
      groupId: input.groupId,
      status: input.status ?? "active",
      targetAmount: input.targetAmount,
      totalRaised: 0,
      createdAt: new Date().toISOString(),
    };

    campaigns.set(campaign.id, campaign);
    return campaign;
  },

  getCampaign(campaignId: string): Campaign | undefined {
    return campaigns.get(campaignId);
  },

  updateCampaignTarget(campaignId: string, targetAmount: number): Campaign | undefined {
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      return undefined;
    }
    campaign.targetAmount = targetAmount;
    campaigns.set(campaign.id, campaign);
    return campaign;
  },

  addPaymentMethod(input: {
    campaignId: string;
    methodType: PaymentMethodType;
    value: string;
    label: string;
  }): PaymentMethod {
    const method: PaymentMethod = {
      id: uuidv4(),
      campaignId: input.campaignId,
      methodType: input.methodType,
      value: input.value,
      label: input.label,
    };

    paymentMethods.set(method.id, method);
    return method;
  },

  listPaymentMethods(campaignId: string): PaymentMethod[] {
    return Array.from(paymentMethods.values()).filter((m) => m.campaignId === campaignId);
  },

  findContributorBySender(campaignId: string, senderName: string): Contributor | undefined {
    const normalized = senderName.trim().toLowerCase();

    return Array.from(contributors.values()).find((c) => {
      if (c.campaignId !== campaignId) {
        return false;
      }

      const byFormal = c.formalName.trim().toLowerCase() === normalized;
      const byDisplay = c.displayName.trim().toLowerCase() === normalized;
      const byAlt = c.alternateSenders.map((s) => s.trim().toLowerCase()).includes(normalized);
      return byFormal || byDisplay || byAlt;
    });
  },

  createContributor(input: {
    campaignId: string;
    formalName: string;
    displayName: string;
    identityType?: IdentityType;
    alternateSenders?: string[];
  }): Contributor {
    const canonicalId = uuidv4();

    const contributor: Contributor = {
      id: uuidv4(),
      campaignId: input.campaignId,
      formalName: input.formalName,
      displayName: input.displayName,
      identityType: input.identityType ?? "individual",
      alternateSenders: input.alternateSenders ?? [input.formalName],
      canonicalId,
      totalContributed: 0,
    };

    contributors.set(contributor.id, contributor);
    return contributor;
  },

  addAlternateSender(contributorId: string, senderName: string): Contributor | undefined {
    const contributor = contributors.get(contributorId);
    if (!contributor) {
      return undefined;
    }

    if (!contributor.alternateSenders.includes(senderName)) {
      contributor.alternateSenders.push(senderName);
      contributors.set(contributor.id, contributor);
    }

    return contributor;
  },

  listContributors(campaignId: string): Contributor[] {
    return Array.from(contributors.values()).filter((c) => c.campaignId === campaignId);
  },

  findDuplicateTransaction(transactionCode: string): Transaction | undefined {
    return Array.from(transactions.values()).find((t) => t.transactionCode === transactionCode);
  },

  createTransaction(input: Omit<Transaction, "id">): Transaction {
    const transaction: Transaction = {
      id: uuidv4(),
      ...input,
    };

    const contributor = contributors.get(transaction.contributorId);
    const campaign = campaigns.get(transaction.campaignId);

    if (!contributor || !campaign) {
      throw new Error("Campaign or contributor not found");
    }

    contributor.totalContributed += transaction.amount;
    campaign.totalRaised += transaction.amount;

    contributors.set(contributor.id, contributor);
    campaigns.set(campaign.id, campaign);
    transactions.set(transaction.id, transaction);

    return transaction;
  },

  listTransactions(campaignId: string): Transaction[] {
    return Array.from(transactions.values()).filter((t) => t.campaignId === campaignId);
  },
};
