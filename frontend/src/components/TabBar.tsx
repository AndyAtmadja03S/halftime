import clsx from "clsx";
import type { ReactNode } from "react";

export type Tab = "capture" | "discover" | "graph" | "profile";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const ICONS: Record<Tab, ReactNode> = {
  capture: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
    </svg>
  ),
  discover: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M15.5 8.5l-2 5-5 2 2-5 5-2z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle
        cx="12"
        cy="9"
        r="3.4"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M5 20c1.2-3.4 4-5 7-5s5.8 1.6 7 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle cx="6" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="18" cy="6" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="12" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7l4 8M16 7l-4 8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
};

const TABS: Tab[] = ["capture", "discover", "graph", "profile"];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-100 bg-ink-0/95 backdrop-blur">
      <div
        className="mx-auto grid max-w-md grid-cols-4"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 8px)" }}
      >
        {TABS.map((tab) => {
          const isActive = tab === active;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              aria-label={tab}
              aria-pressed={isActive}
              className={clsx(
                "grid place-items-center py-3 transition",
                isActive ? "text-mist-500" : "text-mist-100 hover:text-mist-300",
              )}
            >
              <span
                className={clsx(
                  "grid h-11 w-11 place-items-center rounded-full transition",
                  isActive && "ring-1 ring-line-300",
                )}
              >
                {ICONS[tab]}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
