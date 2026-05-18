import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import { CaptureScreen } from "./screens/CaptureScreen";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { fetchFeed, fetchTodayStatus, type Post } from "./lib/api";

export default function App() {
  const [tab, setTab] = useState<Tab>("discover");
  const [hasPostedToday, setHasPostedToday] = useState(false);
  const [todaysPost, setTodaysPost] = useState<Post | null>(null);

  useEffect(() => {
    fetchTodayStatus()
      .then((s) => setHasPostedToday(s.hasPostedToday))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hasPostedToday || todaysPost) return;
    fetchFeed({ mine: true, limit: 1 })
      .then((res) => {
        const today = new Date().toISOString().slice(0, 10);
        const found = res.posts.find(
          (p) => p.created_at.slice(0, 10) === today,
        );
        if (found) setTodaysPost(found);
      })
      .catch(() => undefined);
  }, [hasPostedToday, todaysPost]);

  const handlePosted = useCallback((post: Post) => {
    setHasPostedToday(true);
    setTodaysPost(post);
  }, []);

  const rightSlot =
    tab === "discover" ? (
      <button
        type="button"
        aria-label="Search"
        className="grid h-9 w-9 place-items-center rounded-full text-mist-300 hover:bg-white/[0.04]"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle
            cx="11"
            cy="11"
            r="6.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M16 16l4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>
    ) : tab === "profile" ? (
      <button
        type="button"
        aria-label="Settings"
        className="grid h-9 w-9 place-items-center rounded-full text-mist-300 hover:bg-white/[0.04]"
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle
            cx="12"
            cy="12"
            r="3"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    ) : null;

  return (
    <div className="mx-auto flex h-svh w-full max-w-md flex-col bg-ink-0 text-mist-300">
      <TopBar rightSlot={rightSlot} />
      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 overflow-y-auto pb-24"
          >
            {tab === "capture" ? (
              <CaptureScreen
                hasPostedToday={hasPostedToday}
                todaysPost={todaysPost}
                onPosted={handlePosted}
              />
            ) : tab === "discover" ? (
              <div className="absolute inset-0 flex h-full flex-col pb-24">
                <DiscoverScreen
                  hasPostedToday={hasPostedToday}
                  todaysPost={todaysPost}
                  onPosted={handlePosted}
                />
              </div>
            ) : (
              <ProfileScreen />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}
