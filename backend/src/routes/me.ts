import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

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

meRouter.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId!;

    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("username, display_name")
      .eq("id", userId)
      .single();
    if (userErr) throw userErr;

    const { count, error: countErr } = await supabase
      .from("posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (countErr) throw countErr;

    const { data, error } = await supabase
      .from("posts")
      .select("post_date, emoji, category, created_at")
      .eq("user_id", userId)
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
      handle: (user.display_name as string | null) ?? user.username,
      totalCaptures: count ?? 0,
      dayStreak: streak,
      firstActive,
      days: rows,
    });
  } catch (err) {
    next(err);
  }
});
