import { Router } from "express";
import { z } from "zod";
import { BUCKET, supabase } from "../lib/supabase.js";
import { requireDeviceId } from "../middleware/deviceId.js";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
  mine: z.coerce.boolean().optional(),
});

export const feedRouter = Router();

feedRouter.get("/", requireDeviceId, async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    const { limit, before, mine } = parsed.data;
    const deviceId = req.deviceId!;

    let query = supabase
      .from("posts")
      .select(
        "id, device_id, audio_path, duration_ms, emoji, category, description, latitude, longitude, created_at, post_date",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) query = query.lt("created_at", before);
    if (mine) query = query.eq("device_id", deviceId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data ?? [];
    const signed = await Promise.all(
      rows.map((row) =>
        supabase.storage.from(BUCKET).createSignedUrl(row.audio_path, 60 * 60),
      ),
    );

    const posts = rows.map((row, i) => ({
      id: row.id,
      emoji: row.emoji,
      category: row.category,
      description: row.description,
      duration_ms: row.duration_ms,
      created_at: row.created_at,
      latitude: row.latitude,
      longitude: row.longitude,
      audio_url: signed[i].data?.signedUrl ?? null,
      is_mine: row.device_id === deviceId,
    }));

    const nextCursor =
      posts.length === limit ? posts[posts.length - 1].created_at : null;

    res.json({ posts, nextCursor });
  } catch (err) {
    next(err);
  }
});

feedRouter.get("/today", requireDeviceId, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("posts")
      .select("id, created_at")
      .eq("device_id", req.deviceId!)
      .eq("post_date", today)
      .maybeSingle();
    if (error) throw error;
    res.json({ hasPostedToday: !!data });
  } catch (err) {
    next(err);
  }
});
