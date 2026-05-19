import { supabase } from "./supabase.js";

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const [outgoing, incoming] = await Promise.all([
    supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", userId)
      .eq("status", "accepted"),
    supabase
      .from("friendships")
      .select("user_id")
      .eq("friend_id", userId)
      .eq("status", "accepted"),
  ]);

  if (outgoing.error) throw outgoing.error;
  if (incoming.error) throw incoming.error;

  const ids = new Set<string>();
  for (const row of outgoing.data ?? []) ids.add(row.friend_id as string);
  for (const row of incoming.data ?? []) ids.add(row.user_id as string);
  return [...ids];
}
