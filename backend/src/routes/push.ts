import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const pushRouter = Router();

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  tzOffset: z.number().int().min(-840).max(840).default(0),
});

// POST /api/push/subscribe — save or refresh a push subscription
pushRouter.post(
  "/subscribe",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = SubscribeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_body" });
      return;
    }
    const { endpoint, p256dh, auth, tzOffset } = parsed.data;
    const userId = req.userId!;

    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: userId, endpoint, p256dh, auth, tz_offset: tzOffset },
      { onConflict: "endpoint" },
    );

    if (error) {
      console.error("[push] subscribe error", error);
      res.status(500).json({ error: "internal_error" });
      return;
    }

    res.json({ ok: true });
  },
);

// DELETE /api/push/subscribe — remove a subscription (user unsubscribes)
pushRouter.delete(
  "/subscribe",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) {
      res.status(400).json({ error: "missing_endpoint" });
      return;
    }

    await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("user_id", req.userId!);

    res.json({ ok: true });
  },
);
