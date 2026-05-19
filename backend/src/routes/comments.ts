import { Router } from "express";
import { z } from "zod";
import { createLogger } from "../lib/log.js";
import { supabase } from "../lib/supabase.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const log = createLogger("comments");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createSchema = z.object({
  body: z.string().trim().min(1).max(280),
  anonymous: z.coerce.boolean().optional(),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

interface CommentRow {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  users?: { username: string } | { username: string }[] | null;
}

function serializeComment(row: CommentRow, viewerUserId?: string | null) {
  const userRel = row.users;
  const username = Array.isArray(userRel)
    ? userRel[0]?.username ?? null
    : userRel?.username ?? null;
  const isMine = !!viewerUserId && row.user_id === viewerUserId;
  return {
    id: row.id,
    body: row.body,
    is_anonymous: row.is_anonymous,
    created_at: row.created_at,
    handle: row.is_anonymous && !isMine ? null : username,
    is_mine: isMine,
  };
}

export const commentsRouter = Router({ mergeParams: true });

commentsRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const postId = String(req.params.postId ?? "");
    if (!UUID_RE.test(postId)) {
      res.status(400).json({ error: "invalid_post_id" });
      return;
    }
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    const { data, error } = await supabase
      .from("post_comments")
      .select(
        "id, post_id, user_id, body, is_anonymous, created_at, users!post_comments_user_id_fkey(username)",
      )
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(parsed.data.limit);
    if (error) throw error;
    const rows = ((data ?? []) as unknown) as CommentRow[];
    res.json({
      comments: rows.map((row) => serializeComment(row, req.userId)),
    });
  } catch (err) {
    next(err);
  }
});

commentsRouter.post("/", requireAuth, async (req, res, next) => {
  try {
    const postId = String(req.params.postId ?? "");
    if (!UUID_RE.test(postId)) {
      res.status(400).json({ error: "invalid_post_id" });
      return;
    }
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_comment", details: parsed.error.flatten() });
      return;
    }

    const { data: postCheck, error: postErr } = await supabase
      .from("posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (postErr) throw postErr;
    if (!postCheck) {
      res.status(404).json({ error: "post_not_found" });
      return;
    }

    const { data, error } = await supabase
      .from("post_comments")
      .insert({
        post_id: postId,
        user_id: req.userId!,
        body: parsed.data.body,
        is_anonymous: parsed.data.anonymous ?? false,
      })
      .select(
        "id, post_id, user_id, body, is_anonymous, created_at, users!post_comments_user_id_fkey(username)",
      )
      .single();
    if (error) {
      log.error("insert comment failed", error);
      throw error;
    }
    res
      .status(201)
      .json({ comment: serializeComment(data as CommentRow, req.userId) });
  } catch (err) {
    next(err);
  }
});

commentsRouter.delete("/:commentId", requireAuth, async (req, res, next) => {
  try {
    const postId = String(req.params.postId ?? "");
    const commentId = String(req.params.commentId ?? "");
    if (!UUID_RE.test(postId) || !UUID_RE.test(commentId)) {
      res.status(400).json({ error: "invalid_id" });
      return;
    }
    const { data: existing, error: fetchErr } = await supabase
      .from("post_comments")
      .select("id, user_id")
      .eq("id", commentId)
      .eq("post_id", postId)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!existing) {
      res.status(404).json({ error: "comment_not_found" });
      return;
    }
    if (existing.user_id !== req.userId) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const { error: delErr } = await supabase
      .from("post_comments")
      .delete()
      .eq("id", commentId);
    if (delErr) throw delErr;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
