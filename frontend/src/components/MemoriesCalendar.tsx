import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { DayEntry } from "../lib/api";

interface Props {
  year: number;
  monthIndex: number;
  days: DayEntry[];
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function MemoriesCalendar({
  year,
  monthIndex,
  days,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: Props) {
  const byDate = useMemo(() => {
    const map = new Map<string, DayEntry>();

    for (const d of days) {
      map.set(d.date, d);
    }

    return map;
  }, [days]);

  const total = daysInMonth(year, monthIndex);

  const now = new Date();

  const isCurrentMonth =
    now.getUTCFullYear() === year &&
    now.getUTCMonth() === monthIndex;

  const lastDay = isCurrentMonth ? now.getUTCDate() : total;

  const cells = [];

  for (let day = 1; day <= lastDay; day++) {
    const iso = `${year}-${pad(monthIndex + 1)}-${pad(day)}`;
    const entry = byDate.get(iso);

    cells.push({
      day,
      iso,
      entry,
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-4">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          style={{ opacity: hasPrev ? 1 : 0.2 }}
          className="text-2xl text-mist-300 px-3 py-2"
        >
          ←
        </button>

        <span className="text-xs uppercase tracking-[var(--tracking-chrome)] text-mist-200">
          {MONTHS[monthIndex]} {year}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          style={{ opacity: hasNext ? 1 : 0.2 }}
          className="text-2xl text-mist-300 px-3 py-2"
        >
          →
        </button>
      </div>

      <motion.div
        layout
        initial={false}
        className="grid grid-cols-4 gap-3"
      >
        {cells.map(({ day, iso, entry }) => (
          <motion.div
            key={iso}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={clsx(
              "relative aspect-square rounded-xl border",
              entry
                ? "border-line-200 bg-ink-200"
                : "border-line-100 bg-transparent"
            )}
          >
            {entry ? (
              <span
                aria-hidden
                className="absolute inset-0 grid place-items-center text-3xl leading-none"
              >
                {entry.emoji}
              </span>
            ) : null}

            <span
              className={clsx(
                "absolute bottom-1.5 left-0 right-0 text-center text-[10px] tracking-[0.12em]",
                entry ? "text-mist-200" : "text-mist-100"
              )}
            >
              {pad(day)}
            </span>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
