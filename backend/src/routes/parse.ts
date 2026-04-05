import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { handleParsedTransaction } from "./shared/parseHandler";

const parseRouter = Router();
parseRouter.use(requireAuth);

parseRouter.post("/", requireRole("admin", "treasurer"), async (req, res) => {
  return handleParsedTransaction(req, res);
});

export { parseRouter };
