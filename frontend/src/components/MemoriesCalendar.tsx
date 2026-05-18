import clsx from "clsx";
import { motion } from "framer-motion";
import { useMemo } from "react";
import type { DayEntry } from "../lib/api";

interface Props {
  year: number;
  monthIndex: number;
  days: DayEntry[];
  onPrev: () => void;
  hasPrev: boolean;
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

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function MemoriesCalendar({
  year,
  monthIndex,
  days,
  onPrev,
  hasPrev,
}: Props) {
  const cells = useMemo(() => {
    const prefix = `${year}-${pad(monthIndex + 1)}-`;
    return days
      .filter((d) => d.date.startsWith(prefix))
      .map((d) => ({
        iso: d.date,
        day: Number(d.date.slice(-2)),
        emoji: d.emoji,
      }))
      .sort((a, b) => b.day - a.day);
  }, [days, year, monthIndex]);

  return (
    <section className="flex flex-col gap-4">
      <p className="text-center text-xs tracking-[var(--tracking-chrome)] text-mist-200 uppercase">
        {MONTHS[monthIndex]} {year}
      </p>

      <motion.div layout className="grid grid-cols-4 gap-3" initial={false}>
        {cells.map(({ day, iso, emoji }) => {
          const filled = Boolean(emoji);
          return (
            <motion.div
              key={iso}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={clsx(
                "relative aspect-square rounded-2xl border",
                filled
                  ? "border-line-200 bg-ink-300"
                  : "border-line-100 bg-ink-100",
              )}
            >
              {filled ? (
                <>
                  <span
                    className="absolute inset-0 grid place-items-center text-3xl leading-none"
                    aria-hidden
                  >
                    {emoji}
                  </span>
                  <span className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] tracking-[0.12em] text-mist-200">
                    {pad(day)}
                  </span>
                </>
              ) : (
                <span className="absolute inset-0 grid place-items-center text-base text-mist-100">
                  {pad(day)}
                </span>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {hasPrev ? (
        <button
          type="button"
          onClick={onPrev}
          className="mx-auto mt-2 text-xs tracking-[var(--tracking-chrome)] text-mist-200 uppercase underline-offset-4 hover:underline"
        >
          Previous Month
        </button>
      ) : null}
    </section>
  );
}
