/** Empty in dev (Vite proxy). Set VITE_API_URL on Vercel to your Railway URL. */
const API_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
