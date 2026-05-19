import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import { CaptureScreen } from "./screens/CaptureScreen";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { MapScreen } from "./screens/MapScreen";
import { MicTest } from "./screens/MicTest";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SocialGraphScreen } from "./screens/SocialGraphScreen";
import type { Post } from "./lib/api";

const IS_MIC_TEST =
  typeof window !== "undefined" &&
  (window.location.search.includes("mic-test") ||
    window.location.pathname === "/mic-test");

export default function App() {
  if (IS_MIC_TEST) return <MicTest />;
  return <MainApp />;
}

function MainApp() {
  const [tab, setTab] = useState<Tab>("discover");
  const [lastPost, setLastPost] = useState<Post | null>(null);

  const handlePosted = useCallback((post: Post) => {
    setLastPost(post);
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
                todaysPost={lastPost}
                onPosted={handlePosted}
              />
            ) : tab === "discover" ? (
              <DiscoverScreen todaysPost={lastPost} />
            ) : tab === "map" ? (
              <MapScreen />
            ) : tab === "graph" ? (
              <SocialGraphScreen />
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
