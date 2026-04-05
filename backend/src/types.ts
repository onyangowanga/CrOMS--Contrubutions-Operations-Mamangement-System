export type CampaignStatus = "active" | "closed";

export type IdentityType =
  | "individual"
  | "titled_individual"
  | "family"
  | "group"
  | "organization"
  | "anonymous";

export type PaymentMethodType = "paybill" | "till" | "phone" | "bank";

export interface Campaign {
  id: string;
  name: string;
  groupId: string;
  status: CampaignStatus;
  targetAmount?: number;
  totalRaised: number;
  createdAt: string;
}

export interface Contributor {
  id: string;
  campaignId: string;
  formalName: string;
  displayName: string;
  identityType: IdentityType;
  alternateSenders: string[];
  canonicalId: string;
  totalContributed: number;
}

export interface Transaction {
  id: string;
  campaignId: string;
  contributorId: string;
  amount: number;
  transactionCode: string;
  messageRaw: string;
  senderName: string;
  timestamp: string;
  source: "mpesa" | "bank" | "manual";
}

export interface PaymentMethod {
  id: string;
  campaignId: string;
  methodType: PaymentMethodType;
  value: string;
  label: string;
}

export interface ParseResult {
  amount: number;
  senderName: string;
  transactionCode: string;
  timestamp: string;
  source: "mpesa" | "bank";
}
