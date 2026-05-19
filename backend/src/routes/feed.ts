import { Router } from "express";
import { z } from "zod";
import { getAcceptedFriendIds } from "../lib/friends.js";
import { createLogger } from "../lib/log.js";
import { BUCKET, supabase } from "../lib/supabase.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";

const log = createLogger("feed");

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  before: z.string().datetime().optional(),
  mine: z.coerce.boolean().optional(),
  friends: z.coerce.boolean().optional(),
  sort: z.enum(["hot", "new", "top"]).default("new"),
  offset: z.coerce.number().int().min(0).max(500).default(0),
});

interface FeedRow {
  id: string;
  user_id: string | null;
  device_id: string | null;
  audio_path: string;
  duration_ms: number;
  emoji: string;
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  post_date: string;
  upvotes?: number | null;
  downvotes?: number | null;
  score?: number | null;
  users?: { username: string } | { username: string }[] | null;
}

function hotScore(score: number, createdAt: string): number {
  const sign = Math.sign(score);
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const seconds = new Date(createdAt).getTime() / 1000;
  return sign * order + seconds / 45000;
}

export const feedRouter = Router();

feedRouter.get("/", optionalAuth, async (req, res, next) => {
  try {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    const { limit, before, mine, friends, sort, offset } = parsed.data;
    const userId = req.userId;

    if (mine && friends) {
      res.status(400).json({ error: "invalid_query" });
      return;
    }
    if ((mine || friends) && !userId) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    let friendIds: string[] | null = null;
    if (friends && userId) {
      friendIds = await getAcceptedFriendIds(userId);
      if (friendIds.length === 0) {
        res.json({ posts: [], nextCursor: null });
        return;
      }
    }

    // Try the migration-aware query first (votes columns present). If the
    // columns don't exist yet, fall back to the legacy select so the feed
    // keeps working until the SQL migration is applied.
    const baseCols =
      "id, user_id, device_id, audio_path, duration_ms, emoji, category, description, latitude, longitude, created_at, post_date, users(username)";
    const voteCols = `${baseCols}, upvotes, downvotes, score`;

    const buildQuery = (selectCols: string) => {
      let query = supabase
        .from("posts")
        .select(selectCols)
        .limit(sort === "hot" ? Math.min(limit * 3, 150) : limit);

      if (sort === "new") {
        query = query.order("created_at", { ascending: false });
        if (before) query = query.lt("created_at", before);
      } else if (sort === "top") {
        // Falls back to recency if `score` column is missing — order() with a
        // nonexistent column would error, so only apply when we know it exists.
        if (selectCols === voteCols) {
          query = query
            .order("score", { ascending: false })
            .order("created_at", { ascending: false });
        } else {
          query = query.order("created_at", { ascending: false });
        }
        query = query.range(offset, offset + limit - 1);
      } else {
        // hot — order by created_at server-side, re-rank in JS using score.
        query = query
          .order("created_at", { ascending: false })
          .range(offset, offset + limit * 3 - 1);
      }

      if (friendIds) query = query.in("user_id", friendIds);
      if (mine && userId) query = query.eq("user_id", userId);
      return query;
    };

    let result = await buildQuery(voteCols);
    let votesAvailable = true;
    if (result.error) {
      log.warn("feed: vote columns missing, falling back", {
        error: result.error.message,
      });
      votesAvailable = false;
      result = await buildQuery(baseCols);
      if (result.error) throw result.error;
    }

    let rows = ((result.data ?? []) as unknown) as FeedRow[];

    if (sort === "hot") {
      rows = [...rows]
        .map((r) => ({
          row: r,
          h: hotScore(Number(r.score ?? 0), r.created_at),
        }))
        .sort((a, b) => b.h - a.h)
        .slice(0, limit)
        .map((x) => x.row);
    }

    const [signed, myVotes] = await Promise.all([
      Promise.all(
        rows.map((row) =>
          supabase.storage
            .from(BUCKET)
            .createSignedUrl(row.audio_path, 60 * 60),
        ),
      ),
      userId && rows.length > 0 && votesAvailable
        ? supabase
            .from("post_votes")
            .select("post_id, value")
            .eq("user_id", userId)
            .in(
              "post_id",
              rows.map((r) => r.id),
            )
        : Promise.resolve({
            data: [] as { post_id: string; value: number }[],
            error: null,
          }),
    ]);

    const voteMap = new Map<string, number>();
    for (const v of (myVotes.data ?? []) as {
      post_id: string;
      value: number;
    }[]) {
      voteMap.set(v.post_id, v.value);
    }

    const posts = rows.map((row, i) => {
      const userRel = row.users;
      const username = Array.isArray(userRel)
        ? userRel[0]?.username ?? null
        : userRel?.username ?? null;
      return {
        id: row.id,
        emoji: row.emoji,
        category: row.category,
        description: row.description,
        duration_ms: row.duration_ms,
        created_at: row.created_at,
        latitude: row.latitude,
        longitude: row.longitude,
        audio_url: signed[i].data?.signedUrl ?? null,
        is_mine: userId
          ? row.user_id === userId || row.device_id === userId
          : false,
        handle: username,
        upvotes: Number(row.upvotes ?? 0),
        downvotes: Number(row.downvotes ?? 0),
        score: Number(row.score ?? 0),
        my_vote: voteMap.get(row.id) ?? 0,
      };
    });

    const nextCursor =
      sort === "new" && posts.length === limit
        ? posts[posts.length - 1].created_at
        : null;

    res.json({ posts, nextCursor });
  } catch (err) {
    next(err);
  }
});

feedRouter.get("/today", requireAuth, async (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("posts")
      .select("id, created_at")
      .eq("user_id", req.userId!)
      .eq("post_date", today)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    res.json({ hasPostedToday: !!data });
  } catch (err) {
    next(err);
  }
});
