import { randomBytes } from "node:crypto";
import { supabase } from "./supabase.js";

const SESSION_DAYS = 30;

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SESSION_DAYS);
  return d.toISOString();
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken();
  const { error } = await supabase.from("sessions").insert({
    token,
    user_id: userId,
    expires_at: sessionExpiresAt(),
  });
  if (error) throw error;
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  await supabase.from("sessions").delete().eq("token", token);
}

export async function resolveSession(
  token: string,
): Promise<{ userId: string; username: string; displayName: string | null } | null> {
  const { data: session, error: sessionErr } = await supabase
    .from("sessions")
    .select("user_id, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (sessionErr || !session) return null;

  if (new Date(session.expires_at as string) <= new Date()) {
    await supabase.from("sessions").delete().eq("token", token);
    return null;
  }

  const { data: user, error: userErr } = await supabase
    .from("users")
    .select("id, username, display_name")
    .eq("id", session.user_id)
    .maybeSingle();
  if (userErr || !user) return null;

  return {
    userId: user.id as string,
    username: user.username as string,
    displayName: (user.display_name as string | null) ?? null,
  };
}
