import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AddFriendSheet } from "../components/AddFriendSheet";
import { AuthModal } from "../components/AuthModal";
import { MemoriesCalendar } from "../components/MemoriesCalendar";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriendRequests,
  fetchStats,
  type FriendUser,
  type MeStats,
} from "../lib/api";
import { getStoredUser } from "../lib/auth";

function monthOffset(year: number, monthIndex: number, delta: number) {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}

function formatMonthShort(year: number, monthIndex: number): string {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toLocaleString(undefined, { month: "short", year: "2-digit" });
}

function currentMonthView() {
  const now = new Date();
  return { year: now.getUTCFullYear(), monthIndex: now.getUTCMonth() };
}

function formatFriendCode(raw: string | null | undefined): string {
  if (!raw) return "";
  const stripped = raw.replace(/-/g, "").toUpperCase();
  if (stripped.length !== 8) return stripped;
  return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
}

interface Props {
  authed: boolean;
  onAuthChange: (v: boolean) => void;
}

export function ProfileScreen({ authed, onAuthChange }: Props) {
  const storedUser = getStoredUser();
  const friendCode = storedUser?.friendCode ?? null;

  const [stats, setStats] = useState<MeStats | null>(null);
  const [loading, setLoading] = useState(authed);
  const [authOpen, setAuthOpen] = useState(false);
  const [view, setView] = useState(currentMonthView);
  const [addOpen, setAddOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [incoming, setIncoming] = useState<FriendUser[]>([]);
  const [pendingAction, setPendingAction] = useState<Set<string>>(new Set());

  const refreshRequests = useCallback(() => {
    fetchFriendRequests()
      .then((r) => setIncoming(r.incoming))
      .catch(() => setIncoming([]));
  }, []);

  useEffect(() => {
    if (!authed) {
      setLoading(false);
      setStats(null);
      setIncoming([]);
      return;
    }
    setLoading(true);
    fetchStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
    refreshRequests();
  }, [authed, refreshRequests]);

  const latestView = useMemo(() => {
    if (stats?.firstActive) {
      const d = new Date(stats.firstActive);
      const now = new Date();
      return {
        year: now.getUTCFullYear(),
        monthIndex: now.getUTCMonth(),
        first: {
          year: d.getUTCFullYear(),
          monthIndex: d.getUTCMonth(),
        },
      };
    }
    return { ...currentMonthView(), first: null };
  }, [stats?.firstActive]);

  const firstMonth = latestView.first;

  const hasPrev = useMemo(() => {
    if (!firstMonth) return false;
    const viewStart = new Date(Date.UTC(view.year, view.monthIndex, 1));
    const firstStart = new Date(Date.UTC(firstMonth.year, firstMonth.monthIndex, 1));
    return viewStart > firstStart;
  }, [view, firstMonth]);

  const hasNext = useMemo(() => {
    const viewStart = new Date(Date.UTC(view.year, view.monthIndex, 1));
    const latestStart = new Date(Date.UTC(latestView.year, latestView.monthIndex, 1));
    return viewStart < latestStart;
  }, [view, latestView]);

  const copyCode = async () => {
    if (!friendCode) return;
    try {
      await navigator.clipboard.writeText(friendCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // clipboard blocked; silently ignore
    }
  };

  const respondToRequest = async (
    userId: string,
    action: "accept" | "decline",
  ) => {
    setPendingAction((s) => new Set(s).add(userId));
    const previous = incoming;
    setIncoming((rows) => rows.filter((r) => r.id !== userId));
    try {
      if (action === "accept") await acceptFriendRequest(userId);
      else await declineFriendRequest(userId);
    } catch {
      setIncoming(previous);
    } finally {
      setPendingAction((s) => {
        const next = new Set(s);
        next.delete(userId);
        return next;
      });
    }
  };

  if (!authed) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-6 pb-10">
        <section>
          <h2 className="text-xl font-semibold text-mist-500">Your Memories</h2>
          <p className="mt-2 text-sm text-mist-200">
            Sign in to see your capture history, streak, and calendar.
          </p>
        </section>
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          style={{ color: "var(--color-ink-300)" }}
          className="rounded-lg border border-mist-500 bg-mist-500 px-5 py-3 text-sm font-medium tracking-[var(--tracking-chrome)] uppercase"
        >
          Sign in
        </button>
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          onSuccess={() => {
            setAuthOpen(false);
            onAuthChange(true);
          }}
          title="Sign in to your account"
          subtitle="Use the username and password you created when you first posted."
          defaultMode="login"
        />
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex flex-col gap-6 px-5 pt-6 pb-10">
        <p className="text-sm text-mist-200">Loading your memories…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-5 pt-6 pb-10">
      <section className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-mist-500">Your Memories</h2>
          <p className="mt-1 text-xs tracking-[var(--tracking-chrome)] text-mist-200 uppercase">
            {stats.handle ?? storedUser?.displayName ?? storedUser?.username}
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

      <section className="rounded-2xl border border-line-200 bg-ink-200 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
            Your Code
          </p>
          {copied && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-400 uppercase"
            >
              Copied
            </motion.span>
          )}
        </div>
        <button
          type="button"
          onClick={copyCode}
          disabled={!friendCode}
          className="mt-2 w-full text-left font-mono text-2xl tracking-[0.25em] text-mist-500 transition hover:opacity-80 disabled:opacity-60"
        >
          {friendCode ? formatFriendCode(friendCode) : "Generating…"}
        </button>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="mt-4 w-full rounded-lg border border-line-200 px-4 py-2.5 text-xs font-medium tracking-[var(--tracking-chrome)] text-mist-300 uppercase transition hover:bg-white/[0.04]"
        >
          Add a friend
        </button>
      </section>

      {incoming.length > 0 && (
        <section className="flex flex-col gap-3">
          <p className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
            Pending Requests
          </p>
          <ul className="flex flex-col gap-2">
            {incoming.map((u) => {
              const busy = pendingAction.has(u.id);
              return (
                <li
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-line-200 bg-ink-200 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-mist-500">
                      {u.displayName}
                    </p>
                    <p className="truncate text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                      @{u.username}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respondToRequest(u.id, "decline")}
                      className="rounded-full border border-line-200 px-3 py-1.5 text-[11px] font-medium tracking-[var(--tracking-chrome)] text-mist-200 uppercase transition hover:bg-white/[0.04] disabled:opacity-50"
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void respondToRequest(u.id, "accept")}
                      style={{ color: "var(--color-ink-300)" }}
                      className="rounded-full border border-mist-500 bg-mist-500 px-3 py-1.5 text-[11px] font-medium tracking-[var(--tracking-chrome)] uppercase transition disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

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

      <AddFriendSheet
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        onSuccess={refreshRequests}
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
