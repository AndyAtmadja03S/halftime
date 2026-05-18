import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { z } from "zod";
import { env } from "./env.js";

const client = new OpenAI({ apiKey: env.openaiApiKey });

export const CATEGORIES = [
  "rain",
  "cafe",
  "commute",
  "city_night",
  "nature",
  "ocean",
  "quiet",
  "crowd",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const tagSchema = z.object({
  emoji: z.string().min(1).max(8),
  category: z.enum(CATEGORIES),
  description: z.string().min(1).max(80),
});

export type SoundTag = z.infer<typeof tagSchema>;

export async function transcribe(
  buffer: Buffer,
  filename = "audio.webm",
): Promise<string> {
  const file = await toFile(buffer, filename, { type: "audio/webm" });
  try {
    const result = await client.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
      temperature: 0,
    });
    return typeof result === "string" ? result.trim() : "";
  } catch {
    return "";
  }
}

interface TagInput {
  transcript: string;
  durationMs: number;
  rms?: number;
}

const SYSTEM_PROMPT = `You label a 10-second ambient sound clip uploaded by a stranger to a calm, low-pressure social app called "Lost & Found Frequencies".

You receive:
- A short Whisper transcript (may be empty or fragmentary - the clip is ambient, not speech).
- Duration in milliseconds.
- Optional loudness (RMS, 0-1).

You must return strict JSON with three fields:
- emoji: ONE single emoji that captures the atmosphere. Prefer ambient ones (rain, coffee, train, city, leaves, wave, moon, fire, sparkle, wind).
- category: one of: rain, cafe, commute, city_night, nature, ocean, quiet, crowd, other.
- description: a poetic, cinematic line UNDER 10 WORDS. No quotes. No period at the end is optional. Avoid "you" and "I". Avoid clichés. Feel like a film subtitle, not a caption.

Examples of good descriptions:
- Late-night train ride home
- Rain outside a quiet apartment
- Soft cafe conversations drifting past
- A lonely walk through the city
- Morning birds before sunrise
- Ocean breathing against the shore

If the transcript is empty, infer from duration and loudness. Default to "quiet" / "soft stillness in the room" rather than guessing wildly.`;

export async function tagSound(input: TagInput): Promise<SoundTag> {
  const userPayload = {
    transcript: input.transcript || "(no speech detected)",
    duration_ms: input.durationMs,
    rms: input.rms,
  };

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = tagSchema.safeParse(JSON.parse(raw));
  if (parsed.success) return parsed.data;

  return {
    emoji: "🌫️",
    category: "quiet",
    description: "A soft moment between things",
  };
}
