import type { NextFunction, Request, Response } from "express";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare global {
  namespace Express {
    interface Request {
      deviceId?: string;
    }
  }
}

export function requireDeviceId(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const raw = req.header("x-device-id");
  if (!raw || !UUID_RE.test(raw)) {
    res
      .status(400)
      .json({ error: "missing_or_invalid_device_id" });
    return;
  }
  req.deviceId = raw.toLowerCase();
  next();
}
