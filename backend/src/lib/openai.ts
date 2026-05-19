import OpenAI from "openai";
import { z } from "zod";
import { env } from "./env.js";
import { createLogger } from "./log.js";

const log = createLogger("openai");
const client = new OpenAI({
  apiKey: env.openaiApiKey,
  timeout: 30_000,
  maxRetries: 1,
});

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
  emoji: z.string().min(1).max(32),
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

Match the description to what you actually hear. Vary your output — do not default to a generic line.

Your entire reply must be ONE raw JSON object only. No markdown. No code fences. No text before or after the JSON.`;

/** Pull a single JSON object string out of model output (fences, preamble, etc.). */
function extractJsonObjectString(raw: string): string {
  let s = raw.trim();
  const fenceBlock = /^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i;
  const blockMatch = s.match(fenceBlock);
  if (blockMatch) s = blockMatch[1].trim();

  if (s.startsWith("```")) {
    s = s
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
  }

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return s.slice(start, end + 1);
  }
  return s;
}

export async function tagSound(input: TagInput): Promise<SoundTag> {
  const t0 = Date.now();
  const base64 = input.audio.toString("base64");

  try {
    // Single completion call utilizing OpenAI's native Audio-Preview modal capabilities
    const completion = await client.chat.completions.create({
      model: "gpt-audio",
      modalities: ["text"],
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
              }. Reply with only the JSON object (emoji, category, description).`,
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    if (!raw.trim()) {
      log.warn("gpt.tagSound empty content", { ms: Date.now() - t0 });
    } else {
      let data: unknown;
      try {
        data = JSON.parse(extractJsonObjectString(raw));
      } catch (parseErr) {
        log.warn("gpt.tagSound JSON.parse failed", {
          ms: Date.now() - t0,
          raw: raw.slice(0, 400),
          error:
            parseErr instanceof Error ? parseErr.message : String(parseErr),
        });
        throw parseErr;
      }

      const parsed = tagSchema.safeParse(data);
      if (parsed.success) {
        return {
          ...parsed.data,
          emoji: sanitizeEmoji(parsed.data.emoji, parsed.data.category),
        };
      }

      log.warn("gpt.tagSound schema validation failed, falling back", {
        ms: Date.now() - t0,
        raw: raw.slice(0, 400),
        zod: parsed.error.flatten(),
      });
    }
  } catch (err) {
    log.error("gpt.tagSound ✖ failed", {
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    emoji: "🌫️",
    category: "quiet",
    description: "A soft moment between things",
  };
}

export async function embedDescription(text: string): Promise<number[] | null> {
  const t0 = Date.now();
  try {
    const r = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vec = r.data[0]?.embedding ?? null;
    if (!vec) log.warn("embed empty", { ms: Date.now() - t0 });
    return vec;
  } catch (err) {
    log.warn("embed ✖", {
      ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}