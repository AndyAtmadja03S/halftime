import { Router } from "express";
import { z } from "zod";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, deleteSession } from "../lib/sessions.js";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

const credentialsSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => USERNAME_RE.test(v), {
      message: "Username must be 3–24 chars: lowercase letters, numbers, underscore",
    }),
  password: z.string().min(8).max(128),
});

export const authRouter = Router();

async function claimDevicePosts(userId: string, deviceId: string | undefined) {
  if (!deviceId) return;
  await supabase
    .from("posts")
    .update({ user_id: userId })
    .eq("device_id", deviceId)
    .is("user_id", null);
}

function userPayload(user: {
  id: string;
  username: string;
  display_name: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name ?? user.username.toUpperCase(),
  };
}

authRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "invalid_credentials",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { username, password } = parsed.data;
    const passwordHash = await hashPassword(password);

    const { data: user, error } = await supabase
      .from("users")
      .insert({
        username,
        password_hash: passwordHash,
        display_name: username.toUpperCase(),
      })
      .select("id, username, display_name")
      .single();

    if (error) {
      if (error.code === "23505") {
        res.status(409).json({ error: "username_taken" });
        return;
      }
      throw error;
    }

    await claimDevicePosts(user.id, req.header("x-device-id") ?? undefined);
    const token = await createSession(user.id);

    res.status(201).json({
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid_credentials" });
      return;
    }

    const { username, password } = parsed.data;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, display_name, password_hash")
      .eq("username", username)
      .maybeSingle();

    if (error) throw error;

    const ok =
      user &&
      (await verifyPassword(password, user.password_hash as string));

    if (!ok) {
      res.status(401).json({
        error: "invalid_login",
        message: "Invalid username or password",
      });
      return;
    }

    await claimDevicePosts(user.id, req.header("x-device-id") ?? undefined);
    const token = await createSession(user.id);

    res.json({
      token,
      user: userPayload(user),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    if (req.sessionToken) {
      await deleteSession(req.sessionToken);
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, display_name")
      .eq("id", req.userId!)
      .single();
    if (error) throw error;
    res.json({ user: userPayload(user) });
  } catch (err) {
    next(err);
  }
});
