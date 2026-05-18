const ADJECTIVES = [
  "VOID",
  "QUIET",
  "DRIFT",
  "ECHO",
  "LATE",
  "SOFT",
  "DUSK",
  "AMBER",
  "TIDAL",
  "STILL",
  "FOG",
  "EMBER",
  "NEON",
  "SLOW",
  "MUTED",
  "HUSH",
  "HALF",
  "NORTH",
  "RAIN",
  "FAR",
];

const NOUNS = [
  "LISTENER",
  "WANDERER",
  "ROOM",
  "CHANNEL",
  "RADIO",
  "SIGNAL",
  "STATION",
  "ATTIC",
  "HARBOR",
  "WINDOW",
  "PASSENGER",
  "FIELD",
  "TRAIN",
  "CAFE",
  "TUNNEL",
  "OCEAN",
  "GHOST",
  "WALK",
  "STREAM",
  "PORCH",
];

function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function handleFor(deviceId: string): string {
  const h = fnv1a(deviceId);
  const a = ADJECTIVES[h % ADJECTIVES.length];
  const n = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  return `${a} ${n}`;
}
