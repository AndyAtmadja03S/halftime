import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { BUCKET, supabase } from "../lib/supabase.js";
import { tagSound, transcribe } from "../lib/openai.js";
import { requireDailyWindow } from "../middleware/dailyWindow.js";
import { requireDeviceId } from "../middleware/deviceId.js";

const MAX_BYTES = 1_500_000;
const MAX_DURATION_MS = 11_000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

const metadataSchema = z.object({
  durationMs: z.coerce.number().int().positive().max(MAX_DURATION_MS),
  rms: z.coerce.number().min(0).max(1).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

export const postsRouter = Router();

postsRouter.post(
  "/",
  requireDeviceId,
  requireDailyWindow,
  upload.single("audio"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "missing_audio" });
        return;
      }

      const parsed = metadataSchema.safeParse({
        durationMs: req.body.durationMs,
        rms: req.body.rms,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
      });
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_metadata", details: parsed.error.flatten() });
        return;
      }

      const deviceId = req.deviceId!;
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing, error: existingErr } = await supabase
        .from("posts")
        .select("id")
        .eq("device_id", deviceId)
        .eq("post_date", today)
        .maybeSingle();
      if (existingErr) throw existingErr;
      if (existing) {
        res.status(409).json({ error: "already_posted_today" });
        return;
      }

      const buffer = req.file.buffer;
      const objectPath = `${deviceId}/${randomUUID()}.webm`;

      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buffer, {
          contentType: req.file.mimetype || "audio/webm",
          upsert: false,
        });
      if (uploadErr) throw uploadErr;

      const transcript = await transcribe(buffer);
      const tag = await tagSound({
        transcript,
        durationMs: parsed.data.durationMs,
        rms: parsed.data.rms,
      });

      const { data: inserted, error: insertErr } = await supabase
        .from("posts")
        .insert({
          device_id: deviceId,
          audio_path: objectPath,
          duration_ms: parsed.data.durationMs,
          emoji: tag.emoji,
          category: tag.category,
          description: tag.description,
          transcript: transcript || null,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
        })
        .select("*")
        .single();

      if (insertErr) {
        await supabase.storage.from(BUCKET).remove([objectPath]);
        if (insertErr.code === "23505") {
          res.status(409).json({ error: "already_posted_today" });
          return;
        }
        throw insertErr;
      }

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, 60 * 60);

      res.status(201).json({
        post: {
          id: inserted.id,
          emoji: inserted.emoji,
          category: inserted.category,
          description: inserted.description,
          duration_ms: inserted.duration_ms,
          created_at: inserted.created_at,
          audio_url: signed?.signedUrl ?? null,
          latitude: inserted.latitude,
          longitude: inserted.longitude,
          is_mine: true,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
