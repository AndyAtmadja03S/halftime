const MAP: Record<string, string> = {
  rain: "var(--color-accent-rain)",
  cafe: "var(--color-accent-cafe)",
  commute: "var(--color-accent-commute)",
  city_night: "var(--color-accent-city_night)",
  nature: "var(--color-accent-nature)",
  ocean: "var(--color-accent-ocean)",
  quiet: "var(--color-accent-quiet)",
  crowd: "var(--color-accent-crowd)",
  other: "var(--color-accent-other)",
};

export function colorFor(category: string): string {
  return MAP[category] ?? MAP.other;
}
