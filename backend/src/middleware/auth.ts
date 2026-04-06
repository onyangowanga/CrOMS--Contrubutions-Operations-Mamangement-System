import { NextFunction, Request, Response } from "express";
import { verifyToken } from "../lib/auth";

export interface RequestUser {
  id: string;
  email: string;
  role: "admin" | "treasurer" | "viewer";
  fullName: string;
}

export interface AuthedRequest extends Request {
  user: RequestUser;
}

export function getRequestUser(req: Request): RequestUser {
  return (req as unknown as AuthedRequest).user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): Response | void {
  const authHeader = req.header("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }

  const token = authHeader.substring(7);

  try {
    const user = verifyToken(token);
    (req as AuthedRequest).user = user;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: Array<"admin" | "treasurer" | "viewer">) {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    const user = (req as AuthedRequest).user;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: "Insufficient role" });
    }

    return next();
  };
}
