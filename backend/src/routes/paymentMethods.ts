import { Router } from "express";
import { pool } from "../db/client";
import { requireAuth, requireRole } from "../middleware/auth";

const paymentMethodsRouter = Router();
paymentMethodsRouter.use(requireAuth);

paymentMethodsRouter.get("/campaign/:campaignId", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM payment_methods WHERE campaign_id = $1 ORDER BY created_at ASC",
    [req.params.campaignId]
  );
  return res.json(result.rows);
});

paymentMethodsRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  const { campaignId, methodType, value, label } = req.body;

  if (!campaignId || !methodType || !value || !label) {
    return res.status(400).json({ error: "campaignId, methodType, value, and label are required" });
  }

  const result = await pool.query(
    "INSERT INTO payment_methods (campaign_id, method_type, value, label) VALUES ($1, $2::payment_method_type, $3, $4) RETURNING *",
    [campaignId, methodType, value, label]
  );

  return res.status(201).json(result.rows[0]);
});

paymentMethodsRouter.patch("/:id", requireRole("admin", "treasurer"), async (req, res) => {
  const { methodType, value, label } = req.body;
  const result = await pool.query(
    `
    UPDATE payment_methods
    SET method_type = COALESCE($2::payment_method_type, method_type),
        value = COALESCE($3, value),
        label = COALESCE($4, label)
    WHERE id = $1
    RETURNING *
    `,
    [req.params.id, methodType ?? null, value ?? null, label ?? null]
  );

  if ((result.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  return res.json(result.rows[0]);
});

paymentMethodsRouter.delete("/:id", requireRole("admin", "treasurer"), async (req, res) => {
  const result = await pool.query("DELETE FROM payment_methods WHERE id = $1 RETURNING id", [req.params.id]);

  if ((result.rowCount ?? 0) === 0) {
    return res.status(404).json({ error: "Payment method not found" });
  }

  return res.json({ deleted: true, id: req.params.id });
});

export { paymentMethodsRouter };
