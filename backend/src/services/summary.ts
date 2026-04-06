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

function normalizeSummaryBlock(value?: string | null): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t+/g, " ").replace(/\s+$/g, "").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && lines[index - 1].length > 0));
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
    "SELECT method_type, value, account_reference, label FROM payment_methods WHERE campaign_id = $1 ORDER BY created_at ASC",
    [campaignId]
  );

  const methodLines = (methodsResult.rows as Array<{ method_type: string; value: string; account_reference?: string | null; label: string }>)
    .map((m) => {
      if (m.method_type === "paybill" && m.account_reference) {
        return `PAYBILL: ${m.value} Account: ${m.account_reference} (${m.label})`;
      }

      return `${m.method_type.toUpperCase()}: ${m.value} (${m.label})`;
    });

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
  const headerLines = normalizeSummaryBlock(headerText);
  const additionalLines = normalizeSummaryBlock(additionalInfo);

  const lines = headerLines.length > 0
    ? [`*${headerLines[0]}*`, ...headerLines.slice(1)]
    : [`*${headerText}*`];

  if (additionalLines.length > 0) {
    lines.push("", ...additionalLines);
  }

  lines.push("");

  if (methodLines.length > 0) {
    lines.push(
      "You can still contribute via:",
      methodLines.join("\n"),
      "",
    );
  }

  lines.push(
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
