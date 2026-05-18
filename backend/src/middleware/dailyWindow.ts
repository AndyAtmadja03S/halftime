import type { NextFunction, Request, Response } from "express";

const START_HOUR = 9;
const END_HOUR = 21;

export function requireDailyWindow(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const raw = req.header("x-device-hour");
  const hour = raw === undefined ? new Date().getHours() : Number(raw);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    res.status(400).json({ error: "invalid_device_hour" });
    return;
  }
  if (hour < START_HOUR || hour >= END_HOUR) {
    res.status(403).json({
      error: "outside_window",
      message: "Posts open between 9am and 9pm in your local time.",
    });
    return;
  }
  next();
}
