import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { MemoriesCalendar } from "../components/MemoriesCalendar";
import { MOCK_PROFILE_STATS, MOCK_PROFILE_VIEW } from "../lib/mockProfile";

function monthOffset(year: number, monthIndex: number, delta: number) {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

function formatMonthShort(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

export function ProfileScreen() {
  const stats = MOCK_PROFILE_STATS;
  const [view, setView] = useState(MOCK_PROFILE_VIEW);

  const firstMonth = useMemo(() => {
    if (!stats.firstActive) return null;
    const d = new Date(stats.firstActive);
    return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
  }, [stats.firstActive]);

  const hasPrev = useMemo(() => {
    if (!firstMonth) return false;
    const viewStart = new Date(Date.UTC(view.year, view.monthIndex, 1));
    const firstStart = new Date(
      Date.UTC(firstMonth.year, firstMonth.monthIndex, 1),
    );
    return viewStart > firstStart;
  }, [view, firstMonth]);

  const hasNext = useMemo(() => {
    const viewStart = new Date(Date.UTC(view.year, view.monthIndex, 1));
    const latestStart = new Date(
      Date.UTC(MOCK_PROFILE_VIEW.year, MOCK_PROFILE_VIEW.monthIndex, 1),
    );
    return viewStart < latestStart;
  }, [view]);

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
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              aria-hidden
            >
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
        <StatCard
          label="Month Active"
          value={formatMonthShort(view.year, view.monthIndex)}
        />
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
