import { Router } from "express";
import { pool } from "../db/client";
import { getRequestUser, requireAuth } from "../middleware/auth";
import { getAccessibleCampaign } from "../lib/access";
import { coalescePersonName } from "../utils/names";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/:campaignId/contributors.csv", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const result = await pool.query(
    "SELECT display_name, formal_name, total_contributed FROM contributors WHERE campaign_id = $1 ORDER BY total_contributed DESC",
    [req.params.campaignId]
  );

  const rows = ["display_name,formal_name,total_contributed"];
  for (const row of result.rows) {
    const displayName = coalescePersonName(row.display_name, row.formal_name) || "Contributor";
    const formalName = coalescePersonName(row.formal_name, row.display_name) || displayName;
    rows.push(`${escapeCsv(displayName)},${escapeCsv(formalName)},${row.total_contributed}`);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=campaign-${req.params.campaignId}-contributors.csv`
  );

  return res.send(rows.join("\n"));
});

reportsRouter.get("/:campaignId/statement.xlsx", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const statement = await getCampaignStatement(req.params.campaignId);
  if (!statement) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "CrOMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Statement", {
    properties: { defaultRowHeight: 22 },
    views: [{ state: "frozen", ySplit: 5 }],
  });

  sheet.mergeCells("A1:F1");
  sheet.getCell("A1").value = `${statement.campaignName} Contribution Statement`;
  sheet.getCell("A1").font = { bold: true, size: 16 };

  sheet.mergeCells("A2:F2");
  sheet.getCell("A2").value = `Generated ${new Date().toLocaleString("en-KE")}`;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF61706C" } };

  sheet.addRow([]);
  const summaryRows = [
    ["Contribution Period", statement.period],
    ["Statement Total", formatAmount(statement.statementTotal)],
    ["Total Contributors", String(statement.totalContributors)],
    ["Target", statement.targetAmount === null ? "Not set" : `KES ${formatAmount(statement.targetAmount)}`],
    ["Deficit", statement.deficit === null ? "N/A" : `KES ${formatAmount(statement.deficit)}`],
  ];

  summaryRows.forEach(([label, value]) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
  });

  sheet.addRow([]);
  const headerRow = sheet.addRow(["Contributor", "Reference Code", "Payment Date", "Mode", "Amount (KES)", "Transaction Message"]);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8D2F0B" } };

  for (const row of statement.rows) {
    const excelRow = sheet.addRow([
      row.contributorName,
      row.referenceCode,
      row.paymentDate,
      row.paymentMode,
      row.amount,
      row.transactionMessage,
    ]);
    excelRow.getCell(5).numFmt = "#,##0.00";
    excelRow.alignment = { vertical: "top", wrapText: true };
  }

  sheet.columns = [
    { width: 24 },
    { width: 20 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 52 },
  ];

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=campaign-${req.params.campaignId}-statement.xlsx`);

  const buffer = await workbook.xlsx.writeBuffer();
  return res.send(Buffer.from(buffer));
});

reportsRouter.get("/:campaignId/statement.pdf", async (req, res) => {
  const accessibleCampaign = await getAccessibleCampaign(getRequestUser(req), req.params.campaignId);
  if (!accessibleCampaign) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  const statement = await getCampaignStatement(req.params.campaignId);
  if (!statement) {
    return res.status(404).json({ error: "Campaign not found" });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename=campaign-${req.params.campaignId}-statement.pdf`);

  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.fontSize(18).fillColor("#1d2623").text(`${statement.campaignName} Contribution Statement`, { align: "left" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#61706c").text(`Generated ${new Date().toLocaleString("en-KE")}`);
  doc.moveDown(0.7);
  doc.fontSize(10).fillColor("#1d2623");
  doc.text(`Contribution Period: ${statement.period}`);
  doc.text(`Statement Total: KES ${formatAmount(statement.statementTotal)}`);
  doc.text(`Total Contributors: ${statement.totalContributors}`);
  doc.text(`Target: ${statement.targetAmount === null ? "Not set" : `KES ${formatAmount(statement.targetAmount)}`}`);
  doc.text(`Deficit: ${statement.deficit === null ? "N/A" : `KES ${formatAmount(statement.deficit)}`}`);
  doc.moveDown(1);

  const columns = [40, 150, 245, 330, 395, 460];
  const headers = ["Contributor", "Reference", "Date", "Mode", "Amount", "Message"];

  doc.fontSize(9).fillColor("#8d2f0b");
  headers.forEach((header, index) => {
    doc.text(header, columns[index], doc.y, { width: index === 5 ? 95 : 70 });
  });

  doc.moveDown(0.6);
  doc.strokeColor("#d8c8b2").moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  statement.rows.forEach((row) => {
    const top = doc.y;
    doc.fontSize(8.5).fillColor("#1d2623");
    doc.text(row.contributorName, columns[0], top, { width: 100 });
    doc.text(row.referenceCode, columns[1], top, { width: 85 });
    doc.text(row.paymentDate, columns[2], top, { width: 75 });
    doc.text(row.paymentMode, columns[3], top, { width: 55 });
    doc.text(`KES ${formatAmount(row.amount)}`, columns[4], top, { width: 55, align: "right" });
    doc.text(row.transactionMessage, columns[5], top, { width: 95 });

    const nextY = Math.max(doc.y, top + 24);
    doc.moveTo(40, nextY).lineTo(555, nextY).strokeColor("#eee0ce").stroke();
    doc.y = nextY + 6;

    if (doc.y > 730) {
      doc.addPage();
    }
  });

  doc.end();
});

async function getCampaignStatement(campaignId: string): Promise<StatementData | null> {
  const campaignResult = await pool.query("SELECT id, name, target_amount, total_raised FROM campaigns WHERE id = $1", [campaignId]);
  if ((campaignResult.rowCount ?? 0) === 0) {
    return null;
  }

  const result = await pool.query(
    `
    SELECT
      t.transaction_code,
      t.event_time,
      t.message_raw,
      t.source,
      t.amount,
      t.sender_name,
      c.display_name,
      c.formal_name
    FROM transactions t
    LEFT JOIN contributors c ON c.id = t.contributor_id
    WHERE t.campaign_id = $1
    ORDER BY t.created_at DESC
    `,
    [campaignId]
  );

  const statementRows = result.rows.map((row) => ({
    contributorName: coalescePersonName(row.display_name, row.formal_name, row.sender_name) || "Contributor",
    referenceCode: row.transaction_code,
    paymentDate: row.event_time,
    paymentMode: formatSource(row.source),
    amount: Number(row.amount || 0),
    transactionMessage: row.message_raw,
  }));

  const statementTotal = statementRows.reduce((sum, row) => sum + row.amount, 0);
  const totalContributors = new Set(statementRows.map((row) => row.contributorName)).size;
  const targetAmount = campaignResult.rows[0].target_amount ? Number(campaignResult.rows[0].target_amount) : null;
  const deficit = targetAmount === null ? null : Math.max(targetAmount - Number(campaignResult.rows[0].total_raised || 0), 0);
  const period = statementRows.length
    ? `${statementRows[statementRows.length - 1].paymentDate} to ${statementRows[0].paymentDate}`
    : "No transactions recorded";

  return {
    campaignName: campaignResult.rows[0].name,
    period,
    statementTotal,
    totalContributors,
    targetAmount,
    deficit,
    rows: statementRows,
  };
}

interface StatementData {
  campaignName: string;
  period: string;
  statementTotal: number;
  totalContributors: number;
  targetAmount: number | null;
  deficit: number | null;
  rows: StatementRow[];
}

interface StatementRow {
  contributorName: string;
  referenceCode: string;
  paymentDate: string;
  paymentMode: string;
  amount: number;
  transactionMessage: string;
}

function formatSource(source: string): string {
  if (source === "mpesa") {
    return "M-Pesa";
  }

  if (source === "manual") {
    return "Cash";
  }

  return source ? source.charAt(0).toUpperCase() + source.slice(1) : "Unknown";
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-KE", { maximumFractionDigits: 2 }).format(value);
}

function escapeCsv(value: string): string {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export { reportsRouter };
