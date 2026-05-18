import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { MemoriesCalendar } from "../components/MemoriesCalendar";
import { fetchStats, type MeStats } from "../lib/api";

function monthOffset(year: number, monthIndex: number, delta: number) {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

function formatMonthShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export function ProfileScreen() {
  const [stats, setStats] = useState<MeStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ year: number; monthIndex: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchStats()
      .then((s) => {
        if (!alive) return;
        setStats(s);
        const now = new Date();
        setView({ year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() });
      })
      .catch(() => {
        if (alive) setError("Could not load your memories.");
      });
    return () => { alive = false; };
  }, []);

  const hasPrev = useMemo(() => {
    if (!view) return false;
    const now = new Date();
    const earliest = monthOffset(now.getUTCFullYear(), now.getUTCMonth(), -12);
    const earliestDate = new Date(Date.UTC(earliest.year, earliest.monthIndex, 1));
    const viewDate = new Date(Date.UTC(view.year, view.monthIndex, 1));
    return viewDate > earliestDate;
  }, [view]);

  const hasNext = useMemo(() => {
    if (!view) return false;
    const now = new Date();
    return view.year < now.getUTCFullYear() || (view.year === now.getUTCFullYear() && view.monthIndex < now.getUTCMonth());
  }, [view]);

  if (!stats || !view) {
    return (
      <div className="grid h-full place-items-center text-xs tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
        {error ?? "Loading memories…"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-10">
      <section className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-mist-500">Your Memories</h2>
          <p className="mt-1 text-xs tracking-[var(--tracking-chrome)] text-mist-200 uppercase">
            {stats.handle}
          </p>
        </div>
        <motion.div
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="text-right"
        >
          <p className="flex items-center justify-end gap-1.5 text-2xl font-semibold text-mist-500">
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none" aria-hidden>
              <path
                d="M9 1L1 11h6l-1 8 8-10H8l1-8z"
                fill="var(--color-accent-streak)"
                stroke="var(--color-accent-streak)"
                strokeWidth="1"
                strokeLinejoin="round"
              />
            </svg>
            {stats.dayStreak}
          </p>
          <p className="mt-0.5 text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
            Day Streak
          </p>
        </motion.div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <StatCard label="Total Captures" value={String(stats.totalCaptures)} />
        <StatCard label="Month Active" value={formatMonthShort(stats.firstActive)} />
      </section>

      <MemoriesCalendar
        year={view.year}
        monthIndex={view.monthIndex}
        days={stats.days}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onPrev={() => setView(monthOffset(view.year, view.monthIndex, -1))}
        onNext={() => setView(monthOffset(view.year, view.monthIndex, +1))}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line-200 bg-ink-200 px-4 py-4">
      <p className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-mist-500">{value}</p>
    </div>
  );
}
