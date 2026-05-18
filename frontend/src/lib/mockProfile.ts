import type { MeStats } from "./api";

// Mock data shaped to mirror the Memories screen reference design.
// `emoji: ""` denotes an empty calendar slot (a tracked day with no capture).
export const MOCK_PROFILE_STATS: MeStats = {
  handle: "VOID LISTENER",
  totalCaptures: 128,
  dayStreak: 14,
  firstActive: "2024-01-15",
  days: [
    { date: "2024-10-26", emoji: "", category: "" },
    { date: "2024-10-25", emoji: "", category: "" },
    { date: "2024-10-24", emoji: "🌑", category: "city_night" },
    { date: "2024-10-22", emoji: "🌊", category: "ocean" },
    { date: "2024-10-21", emoji: "🦉", category: "nature" },
    { date: "2024-10-20", emoji: "", category: "" },
    { date: "2024-10-18", emoji: "🎏", category: "other" },
    { date: "2024-10-15", emoji: "🕯️", category: "quiet" },
    { date: "2024-10-12", emoji: "🎄", category: "nature" },
    { date: "2024-10-10", emoji: "🚊", category: "commute" },
    { date: "2024-10-09", emoji: "⚡", category: "rain" },
    { date: "2024-10-05", emoji: "🪐", category: "other" },
    { date: "2024-10-03", emoji: "🗿", category: "quiet" },
    { date: "2024-10-01", emoji: "🌃", category: "city_night" },
  ],
};

export const MOCK_PROFILE_VIEW = { year: 2024, monthIndex: 9 };
