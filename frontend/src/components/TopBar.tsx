import type { ReactNode } from "react";

interface Props {
  rightSlot?: ReactNode;
}

export function TopBar({ rightSlot }: Props) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line-100 bg-ink-0/90 px-5 py-4 backdrop-blur">
      <div className="flex items-center gap-3">
        <span aria-hidden className="grid h-9 w-9 place-items-center">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none">
            <path d="M10.5 10 Q8.5 12 10.5 14"   stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <path d="M8.5 8.5 Q5 12 8.5 15.5"    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <path d="M6.5 7 Q2 12 6.5 17"         stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <path d="M13.5 10 Q15.5 12 13.5 14"  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <path d="M15.5 8.5 Q19 12 15.5 15.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <path d="M17.5 7 Q22 12 17.5 17"      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-mist-400" />
            <circle cx="12" cy="12" r="1.5" fill="currentColor" className="text-mist-500" />
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