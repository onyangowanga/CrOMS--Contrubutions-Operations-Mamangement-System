import { pool } from "../db/client";
import { coalescePersonName, normalizePersonName } from "../utils/names";

interface SummaryOptions {
  headerText?: string;
  additionalInfo?: string;
  includeTarget?: boolean;
  includeDeficit?: boolean;
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(value);
}

export async function generateWhatsappSummary(campaignId: string, options: SummaryOptions = {}): Promise<string> {
  const campaignResult = await pool.query(
    "SELECT id, name, target_amount, total_raised, whatsapp_header_text, whatsapp_additional_info FROM campaigns WHERE id = $1",
    [campaignId]
  );

  if ((campaignResult.rowCount ?? 0) === 0) {
    throw new Error("Campaign not found");
  }

  const campaign = campaignResult.rows[0];

  const contribResult = await pool.query(
    "SELECT display_name, formal_name, total_contributed FROM contributors WHERE campaign_id = $1 AND total_contributed > 0 ORDER BY total_contributed DESC",
    [campaignId]
  );

  const methodsResult = await pool.query(
    "SELECT method_type, value, label FROM payment_methods WHERE campaign_id = $1 ORDER BY created_at ASC",
    [campaignId]
  );

  const methodLines = (methodsResult.rows as Array<{ method_type: string; value: string; label: string }>).length
    ? (methodsResult.rows as Array<{ method_type: string; value: string; label: string }>)
        .map((m) => `${m.method_type.toUpperCase()}: ${m.value} (${m.label})`)
        .join("\n")
    : "No payment method configured yet.";

  const contributorLines = (contribResult.rows as Array<{ display_name: string; formal_name: string; total_contributed: string }>).length
    ? (contribResult.rows as Array<{ display_name: string; formal_name: string; total_contributed: string }>)
        .map((c, i) => {
          const name = coalescePersonName(c.display_name, c.formal_name) || "Contributor";
          return `${i + 1}. ${name} - KES ${currency(Number(c.total_contributed))}`;
        })
        .join("\n")
    : "No contributions recorded yet.";

  const totalRaised = Number(campaign.total_raised);
  const targetAmount = campaign.target_amount ? Number(campaign.target_amount) : null;
  const deficit = targetAmount === null ? null : Math.max(targetAmount - totalRaised, 0);
  const headerText = options.headerText?.trim() || campaign.whatsapp_header_text?.trim() || `${normalizePersonName(campaign.name) || campaign.name} - CONTRIBUTION UPDATE`;
  const additionalInfo = options.additionalInfo?.trim() || campaign.whatsapp_additional_info?.trim();

  const lines = [
    `*${headerText}*`,
  ];

  if (additionalInfo) {
    lines.push(additionalInfo);
  }

  lines.push(
    "",
    "You can still contribute via:",
    methodLines,
    "",
    "--------------------------------",
    contributorLines,
    "--------------------------------",
    `TOTAL: KES ${currency(totalRaised)}`,
  );

  if (options.includeTarget !== false) {
    lines.push(targetAmount === null ? "TARGET: Not set" : `TARGET: KES ${currency(targetAmount)}`);
  }

  if (options.includeDeficit !== false) {
    lines.push(deficit === null ? "DEFICIT: N/A" : `DEFICIT: KES ${currency(deficit)}`);
  }

  lines.push("", "Thank you for your support.");

  return lines.join("\n");
}
