import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth } from "../middleware/auth";

const reportsRouter = Router();
reportsRouter.use(requireAuth);

reportsRouter.get("/:campaignId/contributors.csv", async (req, res) => {
  const result = await pool.query(
    "SELECT display_name, formal_name, total_contributed FROM contributors WHERE campaign_id = $1 ORDER BY total_contributed DESC",
    [req.params.campaignId]
  );

  const rows = ["display_name,formal_name,total_contributed"];
  for (const row of result.rows) {
    rows.push(`${escapeCsv(row.display_name)},${escapeCsv(row.formal_name)},${row.total_contributed}`);
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=campaign-${req.params.campaignId}-contributors.csv`
  );

  return res.send(rows.join("\n"));
});

function escapeCsv(value: string): string {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export { reportsRouter };
