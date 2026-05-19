/**
 * Daily recording reminder scheduler.
 *
 * Checks every 5 minutes whether any subscribed users need a push notification.
 * Notification slots (local time):
 *   slot 0 → 09:00  (first reminder)
 *   slot 1 → 13:00  (second, if no post yet)
 *   slot 2 → 17:00  (third)
 *   slot 3 → 20:00  (final — last call before 21:00 cutoff)
 *
 * A log row in push_notification_logs guarantees we never double-send
 * the same slot for the same subscription on the same day, even across
 * server restarts.
 */

import webpush from "web-push";
import { supabase } from "./supabase.js";
import { env } from "./env.js";
import { createLogger } from "./log.js";

const log = createLogger("scheduler");

// Local hours that trigger a notification slot
const SLOTS: Record<number, number> = { 9: 0, 13: 1, 17: 2, 20: 3 };

webpush.setVapidDetails(
  env.vapidSubject,
  env.vapidPublicKey,
  env.vapidPrivateKey,
);

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz_offset: number; // minutes behind UTC (getTimezoneOffset())
}

/** Convert UTC Date → local hour for a given tz_offset */
function localHour(utc: Date, tzOffsetMinutes: number): number {
  // getTimezoneOffset() returns positive for west of UTC, negative for east.
  // local = UTC - offset_minutes → e.g. UTC+10 (tzOffset=-600): local = UTC + 10h
  const localMs = utc.getTime() - tzOffsetMinutes * 60_000;
  return new Date(localMs).getUTCHours();
}

/** Local YYYY-MM-DD date string for a given tz_offset */
function localDate(utc: Date, tzOffsetMinutes: number): string {
  const localMs = utc.getTime() - tzOffsetMinutes * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

async function hasPostedToday(userId: string, date: string): Promise<boolean> {
  const { count } = await supabase
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("post_date", date);
  return (count ?? 0) > 0;
}

async function alreadySent(
  subscriptionId: string,
  date: string,
  slot: number,
): Promise<boolean> {
  const { count } = await supabase
    .from("push_notification_logs")
    .select("subscription_id", { count: "exact", head: true })
    .eq("subscription_id", subscriptionId)
    .eq("notif_date", date)
    .eq("notif_slot", slot);
  return (count ?? 0) > 0;
}

async function logSent(
  subscriptionId: string,
  date: string,
  slot: number,
): Promise<void> {
  await supabase.from("push_notification_logs").insert({
    subscription_id: subscriptionId,
    notif_date: date,
    notif_slot: slot,
  });
}

const SLOT_MESSAGES: Record<number, { title: string; body: string }> = {
  0: {
    title: "FREQUENCIES",
    body: "Time to capture today's frequency. What does your world sound like right now?",
  },
  1: {
    title: "FREQUENCIES",
    body: "Still haven't recorded today. Your frequency is waiting.",
  },
  2: {
    title: "FREQUENCIES",
    body: "Afternoon check-in — the day isn't over yet. Capture your sound.",
  },
  3: {
    title: "FREQUENCIES",
    body: "Last chance — record tonight's frequency before midnight.",
  },
};

async function runCheck(): Promise<void> {
  const now = new Date();
  const nowMinute = now.getUTCMinutes();

  // Only fire in the first 5 minutes of each hour to avoid duplicate runs
  if (nowMinute >= 5) return;

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, tz_offset");

  if (error || !subs?.length) return;

  for (const sub of subs as Subscription[]) {
    const hour = localHour(now, sub.tz_offset);
    const slot = SLOTS[hour];

    // Not a notification hour, or past 9pm cutoff
    if (slot === undefined || hour >= 21) continue;

    const date = localDate(now, sub.tz_offset);

    // Skip if already sent this slot
    if (await alreadySent(sub.id, date, slot)) continue;

    // Skip if user already posted today
    if (await hasPostedToday(sub.user_id, date)) continue;

    const msg = SLOT_MESSAGES[slot];
    const payload = JSON.stringify({
      title: msg.title,
      body: msg.body,
      url: "/",
    });

    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 3600 },
      );
      await logSent(sub.id, date, slot);
      log.info(`Sent slot ${slot} to subscription ${sub.id}`);
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 410 || status === 404) {
        // Subscription expired — remove it
        log.info(`Removing expired subscription ${sub.id}`);
        await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", sub.id);
      } else {
        log.info(`Push failed for ${sub.id}: ${String(err)}`);
      }
    }
  }
}

export function startScheduler(): void {
  if (!env.vapidPublicKey || !env.vapidPrivateKey) {
    log.info("VAPID keys not set — push scheduler disabled");
    return;
  }

  // Run immediately on startup, then every 5 minutes
  void runCheck();
  setInterval(() => void runCheck(), 5 * 60 * 1000);
  log.info("Push notification scheduler started");
}
