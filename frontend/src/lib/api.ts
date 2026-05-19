import { getDeviceHour, getDeviceId } from "./deviceId";

export interface Post {
  id: string;
  emoji: string;
  category: string;
  description: string;
  duration_ms: number;
  created_at: string;
  audio_url: string | null;
  latitude: number | null;
  longitude: number | null;
  is_mine: boolean;
}

export interface DayEntry {
  date: string;
  emoji: string;
  category: string;
}

export interface MeStats {
  handle: string;
  totalCaptures: number;
  dayStreak: number;
  firstActive: string | null;
  days: DayEntry[];
}

export interface FeedResponse {
  posts: Post[];
  nextCursor: string | null;
}

function deviceHeaders(): HeadersInit {
  return {
    "x-device-id": getDeviceId(),
    "x-device-hour": String(getDeviceHour()),
  };
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: { error?: string; message?: string } = {};
    try {
      body = await res.json();
    } catch {
      // ignore
    }
    throw new ApiError(res.status, body.error ?? "request_failed", body.message);
  }
  return res.json() as Promise<T>;
}

export async function fetchFeed(params: {
  before?: string;
  limit?: number;
  mine?: boolean;
} = {}): Promise<FeedResponse> {
  const qs = new URLSearchParams();
  if (params.before) qs.set("before", params.before);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.mine) qs.set("mine", "1");
  const res = await fetch(`/api/feed?${qs.toString()}`, {
    headers: deviceHeaders(),
  });
  return handle<FeedResponse>(res);
}

export async function fetchTodayStatus(): Promise<{ hasPostedToday: boolean }> {
  const res = await fetch(`/api/feed/today`, { headers: deviceHeaders() });
  return handle(res);
}

export interface UploadOptions {
  durationMs: number;
  rms?: number;
  latitude?: number;
  longitude?: number;
  anonymous?: boolean;
}

export async function uploadPost(
  blob: Blob,
  opts: UploadOptions,
): Promise<{ post: Post }> {
  const form = new FormData();
  const filename = blob.type === "audio/wav" ? "clip.wav" : "clip.webm";
  form.append("audio", blob, filename);
  form.append("durationMs", String(opts.durationMs));
  if (opts.rms !== undefined) form.append("rms", String(opts.rms));
  if (opts.latitude !== undefined)
    form.append("latitude", String(opts.latitude));
  if (opts.longitude !== undefined)
    form.append("longitude", String(opts.longitude));

  // Anonymous posts use a one-time random device ID so the post isn't
  // linked to the user's persistent profile.
  const headers: HeadersInit = opts.anonymous
    ? { "x-device-id": crypto.randomUUID(), "x-device-hour": String(getDeviceHour()) }
    : deviceHeaders();

  console.info("[voice] upload → start", {
    bytes: blob.size,
    mime: blob.type,
    durationMs: opts.durationMs,
    rms: opts.rms,
    hasLocation: opts.latitude !== undefined && opts.longitude !== undefined,
  });
  const t0 = performance.now();
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`/api/posts`, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
    const ms = Math.round(performance.now() - t0);
    console.info(`[voice] upload ← ${res.status} in ${ms}ms`);
    return handle(res);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new ApiError(0, "upload_timeout", "Upload timed out");
    }
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchStats(): Promise<MeStats> {
  const res = await fetch(`/api/me/stats`, { headers: deviceHeaders() });
  return handle<MeStats>(res);
}
