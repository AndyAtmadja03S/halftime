import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { createLogger } from "../lib/log.js";
import { BUCKET, supabase } from "../lib/supabase.js";
import { tagSound } from "../lib/openai.js";
import { requireAuth } from "../middleware/auth.js";

const log = createLogger("posts");

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
  requireAuth,
  upload.single("audio"),
  async (req, res, next) => {
    const reqId = randomUUID().slice(0, 8);
    const rlog = log.child(reqId);
    const t0 = Date.now();
    try {
      const userId = req.userId!;

      rlog.info("POST /api/posts received", {
        userId,
        hasFile: !!req.file,
        fileBytes: req.file?.size,
        mimetype: req.file?.mimetype,
        bodyDurationMs: req.body.durationMs,
        bodyRms: req.body.rms,
        hasLocation: !!(req.body.latitude && req.body.longitude),
      });

      if (!req.file) {
        rlog.warn("rejected: missing audio file");
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
        rlog.warn("rejected: invalid metadata", parsed.error.flatten());
        res
          .status(400)
          .json({ error: "invalid_metadata", details: parsed.error.flatten() });
        return;
      }

      const buffer = req.file.buffer;
      const objectPath = `${userId}/${randomUUID()}.wav`;

      rlog.info("storage.upload → start", {
        path: objectPath,
        bytes: buffer.byteLength,
      });
      const uploadT0 = Date.now();
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(objectPath, buffer, {
          contentType: req.file.mimetype || "audio/wav",
          upsert: false,
        });
      if (uploadErr) {
        rlog.error("storage.upload ✖ failed", uploadErr);
        throw uploadErr;
      }
      rlog.info("storage.upload ← done", { ms: Date.now() - uploadT0 });

      const tag = await tagSound({
        audio: buffer,
        durationMs: parsed.data.durationMs,
        rms: parsed.data.rms,
      });

      rlog.info("db.insert → start");
      const insertT0 = Date.now();

      const row: Record<string, unknown> = {
        user_id: userId,
        audio_path: objectPath,
        duration_ms: parsed.data.durationMs,
        emoji: tag.emoji,
        category: tag.category,
        description: tag.description,
        transcript: null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
      };
      // Legacy column if still present in Supabase
      row.device_id = userId;

      const { data: inserted, error: insertErr } = await supabase
        .from("posts")
        .insert(row)
        .select("*")
        .single();

      if (insertErr) {
        rlog.error("db.insert ✖ failed; cleaning up storage object", insertErr);
        await supabase.storage.from(BUCKET).remove([objectPath]);
        throw insertErr;
      }
      rlog.info("db.insert ← done", {
        ms: Date.now() - insertT0,
        postId: inserted.id,
      });

      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, 60 * 60);

      rlog.info("POST /api/posts ✓ complete", {
        totalMs: Date.now() - t0,
        emoji: inserted.emoji,
        category: inserted.category,
      });

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
      const errInfo =
        err instanceof Error
          ? { message: err.message, name: err.name }
          : typeof err === "object" && err !== null
            ? err
            : { value: String(err) };
      rlog.error("POST /api/posts ✖ unhandled", {
        totalMs: Date.now() - t0,
        error: errInfo,
      });
      next(err);
    }
  },
);
