import type { ReactNode } from "react";

interface Props {
  rightSlot?: ReactNode;
}

export function TopBar({ rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line-100 bg-ink-0/90 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid h-7 w-7 place-items-center rounded-full"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M2 12c1.6-1.6 4-2.4 6-2.4M22 12c-1.6-1.6-4-2.4-6-2.4M5 12c1-1 2.4-1.6 4-1.6M19 12c-1-1-2.4-1.6-4-1.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="text-mist-400"
            />
            <circle
              cx="12"
              cy="12"
              r="1.8"
              fill="currentColor"
              className="text-mist-500"
            />
          </svg>
        </span>
        <h1 className="text-sm font-semibold tracking-[var(--tracking-chrome)] text-mist-500 uppercase">
          Frequencies
        </h1>
      </div>
      {rightSlot}
    </header>
  );
}
