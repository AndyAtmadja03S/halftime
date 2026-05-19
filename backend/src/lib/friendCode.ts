import { randomBytes } from "node:crypto";
import { supabase } from "./supabase.js";

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LEN = 8;
const CODE_RE = /^[0-9A-Z]{8}$/;

export function generateFriendCode(): string {
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[bytes[i] % 32];
  return out;
}

export function normalizeFriendCode(input: string): string | null {
  if (typeof input !== "string") return null;
  const stripped = input.replace(/[\s-]+/g, "").toUpperCase();
  if (stripped.length !== CODE_LEN) return null;
  // Map ambiguous characters into the Crockford alphabet.
  const mapped = stripped
    .replace(/I/g, "1")
    .replace(/L/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");
  if (!CODE_RE.test(mapped)) return null;
  for (const ch of mapped) if (!ALPHABET.includes(ch)) return null;
  return mapped;
}

export async function assignFriendCode(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateFriendCode();
    const { data, error } = await supabase
      .from("users")
      .update({ friend_code: candidate })
      .eq("id", userId)
      .is("friend_code", null)
      .select("friend_code")
      .maybeSingle();
    if (!error && data?.friend_code) return data.friend_code as string;
    // 23505 = unique violation → another user grabbed this code first. Retry.
    if (error && (error as { code?: string }).code !== "23505") throw error;
    // No row updated could also mean the user already has a code; re-read.
    const { data: existing } = await supabase
      .from("users")
      .select("friend_code")
      .eq("id", userId)
      .maybeSingle();
    if (existing?.friend_code) return existing.friend_code as string;
  }
  throw new Error("friend_code_assignment_failed");
}

export async function ensureFriendCode(user: {
  id: string;
  friend_code: string | null;
}): Promise<string> {
  if (user.friend_code) return user.friend_code;
  return assignFriendCode(user.id);
}
