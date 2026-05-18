import { Router } from "express";
import { handleFor } from "../lib/handle.js";
import { supabase } from "../lib/supabase.js";
import { requireDeviceId } from "../middleware/deviceId.js";

export const meRouter = Router();

interface DayRow {
  date: string;
  emoji: string;
  category: string;
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  cursor.setUTCHours(0, 0, 0, 0);

  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0;
  }

  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

meRouter.get("/stats", requireDeviceId, async (req, res, next) => {
  try {
    const deviceId = req.deviceId!;

    const { count, error: countErr } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("device_id", deviceId);
    if (countErr) throw countErr;

    const { data, error } = await supabase
      .from("posts")
      .select("post_date, emoji, category, created_at")
      .eq("device_id", deviceId)
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw error;

    const rows = (data ?? []).map((r) => ({
      date: r.post_date as string,
      emoji: r.emoji as string,
      category: r.category as string,
    })) satisfies DayRow[];

    const streak = computeStreak(rows.map((r) => r.date));
    const firstActive =
      rows.length > 0 ? rows[rows.length - 1].date : null;

    res.json({
      handle: handleFor(deviceId),
      totalCaptures: count ?? 0,
      dayStreak: streak,
      firstActive,
      days: rows,
    });
  } catch (err) {
    next(err);
  }
});
