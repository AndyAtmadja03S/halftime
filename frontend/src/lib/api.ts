import { getDeviceHour, getDeviceId } from "./deviceId";
import { getSessionToken, type AuthUser } from "./auth";

export type VoteValue = -1 | 0 | 1;

export type FeedSort = "hot" | "new" | "top";

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
  handle: string | null;
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: VoteValue;
  comment_count: number;
}

export interface VoteResponse {
  upvotes: number;
  downvotes: number;
  score: number;
  my_vote: VoteValue;
}

export interface Comment {
  id: string;
  body: string;
  is_anonymous: boolean;
  created_at: string;
  handle: string | null;
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

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface FriendUser {
  id: string;
  username: string;
  displayName: string;
}

function baseHeaders(): HeadersInit {
  return {
    "x-device-id": getDeviceId(),
    "x-device-hour": String(getDeviceHour()),
  };
}

function authHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    ...(baseHeaders() as Record<string, string>),
  };
  const token = getSessionToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
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
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function register(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { ...baseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handle<AuthResponse>(res);
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResponse> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { ...baseHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return handle<AuthResponse>(res);
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/logout", {
    method: "POST",
    headers: authHeaders(),
  });
  await handle(res);
}

export async function fetchFeed(params: {
  before?: string;
  limit?: number;
  mine?: boolean;
  friends?: boolean;
  sort?: FeedSort;
  offset?: number;
} = {}): Promise<FeedResponse> {
  const qs = new URLSearchParams();
  if (params.before) qs.set("before", params.before);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.mine) qs.set("mine", "1");
  if (params.friends) qs.set("friends", "1");
  if (params.sort) qs.set("sort", params.sort);
  if (params.offset) qs.set("offset", String(params.offset));
  const res = await fetch(`/api/feed?${qs.toString()}`, {
    headers: authHeaders(),
  });
  return handle<FeedResponse>(res);
}

export async function votePost(
  postId: string,
  value: VoteValue,
): Promise<VoteResponse> {
  const res = await fetch(`/api/posts/${encodeURIComponent(postId)}/vote`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
  return handle<VoteResponse>(res);
}

export async function fetchComments(
  postId: string,
): Promise<{ comments: Comment[] }> {
  const res = await fetch(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    { headers: authHeaders() },
  );
  return handle(res);
}

export async function createComment(
  postId: string,
  body: string,
  anonymous: boolean,
): Promise<{ comment: Comment }> {
  const res = await fetch(
    `/api/posts/${encodeURIComponent(postId)}/comments`,
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ body, anonymous }),
    },
  );
  return handle(res);
}

export async function deleteComment(
  postId: string,
  commentId: string,
): Promise<void> {
  const res = await fetch(
    `/api/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
    { method: "DELETE", headers: authHeaders() },
  );
  await handle(res);
}

export async function fetchTodayStatus(): Promise<{ hasPostedToday: boolean }> {
  const res = await fetch(`/api/feed/today`, { headers: authHeaders() });
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
  // linked to the user's persistent profile. Non-anonymous uploads must
  // include the session token — the backend requires auth on POST /api/posts.
  const headers: HeadersInit = opts.anonymous
    ? { "x-device-id": crypto.randomUUID(), "x-device-hour": String(getDeviceHour()) }
    : authHeaders();

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
  const res = await fetch(`/api/me/stats`, { headers: authHeaders() });
  return handle<MeStats>(res);
}

export async function fetchFriends(): Promise<{ friends: FriendUser[] }> {
  const res = await fetch(`/api/friends`, { headers: authHeaders() });
  return handle(res);
}

export async function fetchFriendRequests(): Promise<{ incoming: FriendUser[] }> {
  const res = await fetch(`/api/friends/requests`, { headers: authHeaders() });
  return handle(res);
}

export async function sendFriendRequest(
  code: string,
): Promise<{ status: "pending" | "accepted" }> {
  const res = await fetch(`/api/friends/requests`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  return handle(res);
}

export async function acceptFriendRequest(userId: string): Promise<void> {
  const res = await fetch(`/api/friends/requests/${userId}/accept`, {
    method: "POST",
    headers: authHeaders(),
  });
  await handle(res);
}

export async function declineFriendRequest(userId: string): Promise<void> {
  const res = await fetch(`/api/friends/requests/${userId}/decline`, {
    method: "POST",
    headers: authHeaders(),
  });
  await handle(res);
}

export async function removeFriend(userId: string): Promise<void> {
  const res = await fetch(`/api/friends/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handle(res);
}

export async function searchFeed(q: string, limit = 20): Promise<FeedResponse> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  const res = await fetch(`/api/feed/search?${qs.toString()}`, {
    headers: authHeaders(),
  });
  return handle<FeedResponse>(res);
}