import type { NextFunction, Request, Response } from "express";
import { resolveSession } from "../lib/sessions.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      username?: string;
      sessionToken?: string;
    }
  }
}

function bearerToken(req: Request): string | null {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = bearerToken(req);
  if (!token) {
    next();
    return;
  }
  const session = await resolveSession(token);
  if (session) {
    req.userId = session.userId;
    req.username = session.username;
    req.sessionToken = token;
  }
  next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized", message: "Sign in required" });
    return;
  }
  const session = await resolveSession(token);
  if (!session) {
    res.status(401).json({ error: "unauthorized", message: "Session expired" });
    return;
  }
  req.userId = session.userId;
  req.username = session.username;
  req.sessionToken = token;
  next();
}
