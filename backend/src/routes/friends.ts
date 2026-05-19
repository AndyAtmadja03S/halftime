import { Router } from "express";
import { z } from "zod";
import { normalizeFriendCode } from "../lib/friendCode.js";
import { getAcceptedFriendIds } from "../lib/friends.js";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const friendsRouter = Router();

interface FriendUserRow {
  id: string;
  username: string;
  display_name: string | null;
}

function mapUser(row: FriendUserRow) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name ?? row.username.toUpperCase(),
  };
}

async function fetchUsersByIds(ids: string[]) {
  if (ids.length === 0) return [] as FriendUserRow[];
  const { data, error } = await supabase
    .from("users")
    .select("id, username, display_name")
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as FriendUserRow[];
}

friendsRouter.get("/", requireAuth, async (req, res, next) => {
  try {
    const ids = await getAcceptedFriendIds(req.userId!);
    const users = await fetchUsersByIds(ids);
    res.json({ friends: users.map(mapUser) });
  } catch (err) {
    next(err);
  }
});

friendsRouter.get("/requests", requireAuth, async (req, res, next) => {
  try {
    const me = req.userId!;
    const { data: rows, error } = await supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", me)
      .eq("status", "pending");
    if (error) throw error;
    const requesterIds = (rows ?? []).map((r) => r.user_id as string);
    const users = await fetchUsersByIds(requesterIds);
    res.json({ incoming: users.map(mapUser) });
  } catch (err) {
    next(err);
  }
});

const requestSchema = z.object({
  code: z.string().min(1).max(32),
});

friendsRouter.post("/requests", requireAuth, async (req, res, next) => {
  try {
    const me = req.userId!;
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }
    const code = normalizeFriendCode(parsed.data.code);
    if (!code) {
      res.status(400).json({ error: "invalid_code" });
      return;
    }

    const { data: target, error: targetErr } = await supabase
      .from("users")
      .select("id")
      .eq("friend_code", code)
      .maybeSingle();
    if (targetErr) throw targetErr;
    if (!target) {
      res.status(404).json({ error: "code_not_found" });
      return;
    }
    if (target.id === me) {
      res.status(400).json({ error: "cannot_friend_self" });
      return;
    }

    const probe = await supabase
      .from("friendships")
      .select("user_id, friend_id, status")
      .or(
        `and(user_id.eq.${me},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${me})`,
      )
      .maybeSingle();
    if (probe.error) throw probe.error;

    const existing = probe.data;
    if (existing) {
      if (existing.status === "accepted") {
        res.status(409).json({ error: "already_friends" });
        return;
      }
      if (existing.user_id === me) {
        res.status(409).json({ error: "request_already_sent" });
        return;
      }
      // Inbound pending request from target → auto-accept.
      const { error: acceptErr } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", target.id)
        .eq("friend_id", me)
        .eq("status", "pending");
      if (acceptErr) throw acceptErr;
      res.status(200).json({ status: "accepted" });
      return;
    }

    const { error: insertErr } = await supabase.from("friendships").insert({
      user_id: me,
      friend_id: target.id,
      status: "pending",
    });
    if (insertErr) {
      // Race: row created in the meantime. Treat as already-sent.
      if ((insertErr as { code?: string }).code === "23505") {
        res.status(409).json({ error: "request_already_sent" });
        return;
      }
      throw insertErr;
    }
    res.status(201).json({ status: "pending" });
  } catch (err) {
    next(err);
  }
});

friendsRouter.post(
  "/requests/:userId/accept",
  requireAuth,
  async (req, res, next) => {
    try {
      const me = req.userId!;
      const requesterId = req.params.userId;
      const { data, error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("user_id", requesterId)
        .eq("friend_id", me)
        .eq("status", "pending")
        .select("user_id");
      if (error) throw error;
      if (!data || data.length === 0) {
        res.status(404).json({ error: "request_not_found" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

friendsRouter.post(
  "/requests/:userId/decline",
  requireAuth,
  async (req, res, next) => {
    try {
      const me = req.userId!;
      const requesterId = req.params.userId;
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("user_id", requesterId)
        .eq("friend_id", me)
        .eq("status", "pending");
      if (error) throw error;
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

friendsRouter.delete("/:userId", requireAuth, async (req, res, next) => {
  try {
    const me = req.userId!;
    const other = req.params.userId;
    const { error } = await supabase
      .from("friendships")
      .delete()
      .or(
        `and(user_id.eq.${me},friend_id.eq.${other}),and(user_id.eq.${other},friend_id.eq.${me})`,
      );
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
