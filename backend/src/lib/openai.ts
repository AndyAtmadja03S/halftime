import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env.js";
import { createLogger } from "./log.js";

const log = createLogger("openai");
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

const CATEGORY_FALLBACK_EMOJI: Record<Category, string> = {
  rain: "🌧️",
  cafe: "☕",
  commute: "🚇",
  city_night: "🌃",
  nature: "🌿",
  ocean: "🌊",
  quiet: "💤",
  crowd: "🔥",
  other: "🌫️",
};

const EMOJI_RE = /\p{Extended_Pictographic}/u;

function sanitizeEmoji(raw: string, category: Category): string {
  return EMOJI_RE.test(raw) ? raw : CATEGORY_FALLBACK_EMOJI[category];
}

interface TagInput {
  audio: Buffer;
  durationMs: number;
  rms?: number;
}

const SYSTEM_PROMPT = `You label a 10-second ambient sound clip uploaded by a stranger to a calm, low-pressure social app called "Lost & Found Frequencies".

You will be given a short audio clip. LISTEN to it carefully and identify what is actually happening in the environment — rain, café chatter, a train, traffic, birds, the ocean, an empty room, a crowd, etc. Use what you hear, not assumptions.

Return strict JSON with three fields:
- emoji: ONE single emoji CHARACTER (a Unicode pictograph like 🌧️ ☕ 🚇 🌃 🌿 🌊 💤 🔥). NEVER return a word, label, or description in this field — only an actual emoji glyph.
- category: one of: rain, cafe, commute, city_night, nature, ocean, quiet, crowd, other.
- description: a poetic, cinematic line UNDER 10 WORDS. No quotes. Avoid "you" and "I". Avoid clichés. Feel like a film subtitle, not a caption.

Examples of good descriptions:
- Late-night train ride home
- Rain outside a quiet apartment
- Soft cafe conversations drifting past
- A lonely walk through the city
- Morning birds before sunrise
- Ocean breathing against the shore

Match the description to what you actually hear. Vary your output — do not default to a generic line.`;

export async function tagSound(input: TagInput): Promise<SoundTag> {
  const base64 = input.audio.toString("base64");

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini-audio-preview",
    modalities: ["text"],
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "input_audio",
            input_audio: { data: base64, format: "wav" },
          },
          {
            type: "text",
            text: `Duration: ${input.durationMs}ms. Loudness (RMS 0-1): ${
              input.rms?.toFixed(3) ?? "unknown"
            }. Listen and return strict JSON.`,
          },
        ],
      },
    ],
  });

  const t0 = Date.now();
  let completion;
  try {
    completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(userPayload) },
      ],
    });
  } catch (err) {
    log.error("gpt.tagSound ✖ failed", {
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      emoji: "🌫️",
      category: "quiet",
      description: "A soft moment between things",
    };
  }

  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = tagSchema.safeParse(JSON.parse(raw));
  if (parsed.success) {
    return {
      ...parsed.data,
      emoji: sanitizeEmoji(parsed.data.emoji, parsed.data.category),
    };
  }

  log.warn("gpt.tagSound returned invalid JSON, falling back", {
    ms: Date.now() - t0,
    raw: raw.slice(0, 200),
  });
  return {
    emoji: "🌫️",
    category: "quiet",
    description: "A soft moment between things",
  };
}
