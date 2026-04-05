import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthUser {
  id: string;
  email: string;
  role: "admin" | "treasurer" | "viewer";
  fullName: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: "admin" | "treasurer" | "viewer";
  fullName: string;
}

export function signToken(user: AuthUser): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };

  return jwt.sign(payload, config.jwtSecret, {
    expiresIn: "12h",
  });
}

export function verifyToken(token: string): AuthUser {
  const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
  return {
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    fullName: payload.fullName,
  };
}
