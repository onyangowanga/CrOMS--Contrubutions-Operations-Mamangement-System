import path from "node:path";
import fs from "node:fs";
import cors from "cors";
import express from "express";
import { config } from "./config";
import { initializeDatabase } from "./db/init";
import { authRouter } from "./routes/auth";
import { campaignsRouter } from "./routes/campaigns";
import { confirmationsRouter } from "./routes/confirmations";
import { contributorsRouter } from "./routes/contributors";
import { groupsRouter } from "./routes/groups";
import { parseRouter } from "./routes/parse";
import { paymentMethodsRouter } from "./routes/paymentMethods";
import { reportsRouter } from "./routes/reports";
import { summaryRouter } from "./routes/summary";
import { transactionsRouter } from "./routes/transactions";

const app = express();
const port = config.port;

app.use(cors());
app.use(express.json());

const webDistRoot = path.resolve(__dirname, "../../web/dist");
const webRoot = fs.existsSync(webDistRoot) ? webDistRoot : path.resolve(__dirname, "../../web");
const faviconRoot = path.resolve(__dirname, "../../favicon_io");

app.use("/assets", express.static(faviconRoot));
app.use(express.static(webRoot));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "CrOMS API" });
});

app.use("/api/auth", authRouter);
app.use("/api/groups", groupsRouter);
app.use("/api/campaigns", campaignsRouter);
app.use("/api/confirmations", confirmationsRouter);
app.use("/api/parse", parseRouter);
app.use("/api/payment-methods", paymentMethodsRouter);
app.use("/api/transactions", transactionsRouter);
app.use("/api/contributors", contributorsRouter);
app.use("/api/summary", summaryRouter);
app.use("/api/reports", reportsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unhandled server error";
  return res.status(500).json({ error: message });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

async function start(): Promise<void> {
  await initializeDatabase();

  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`CrOMS running on http://localhost:${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server", error);
  process.exit(1);
});
