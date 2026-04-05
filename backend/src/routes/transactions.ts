import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, requireRole } from "../middleware/auth";
import { handleParsedTransaction } from "./shared/parseHandler";

const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

transactionsRouter.post("/parse", requireRole("admin", "treasurer"), async (req, res) => {
  return handleParsedTransaction(req, res);
});

transactionsRouter.get("/:campaignId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM transactions WHERE campaign_id = $1 ORDER BY created_at DESC",
    [req.params.campaignId]
  );
  return res.json(result.rows);
});

export { transactionsRouter };
