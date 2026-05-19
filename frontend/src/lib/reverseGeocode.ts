const cache = new Map<string, string | null>();

/** Returns "Suburb, City" (or best available label) for the given coordinates. */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "Frequencies/1.0" } },
    );
    if (!res.ok) {
      cache.set(key, null);
      return null;
    }
    const data = await res.json();
    const addr = data.address as Record<string, string> | undefined;
    if (!addr) {
      cache.set(key, null);
      return null;
    }
    const suburb =
      addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? null;
    const city =
      addr.city ?? addr.town ?? addr.village ?? addr.county ?? null;
    const label =
      suburb && city
        ? `${suburb}, ${city}`
        : (city ?? suburb ?? null);
    cache.set(key, label);
    return label;
  } catch {
    cache.set(key, null);
    return null;
  }
}
