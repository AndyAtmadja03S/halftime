import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { TabBar, type Tab } from "./components/TabBar";
import { TopBar } from "./components/TopBar";
import { CaptureScreen } from "./screens/CaptureScreen";
import { DiscoverScreen } from "./screens/DiscoverScreen";
import { MapScreen } from "./screens/MapScreen";
import { MicTest } from "./screens/MicTest";
import { ProfileScreen } from "./screens/ProfileScreen";
import { SocialGraphScreen } from "./screens/SocialGraphScreen";
import type { Post } from "./lib/api";
import { logout } from "./lib/api";
import { clearSession, isLoggedIn } from "./lib/auth";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authed, setAuthed] = useState(isLoggedIn());
  const settingsRef = useRef<HTMLDivElement>(null);

  const handlePosted = useCallback((post: Post) => {
    setLastPost(post);
  }, []);

  // Close search when leaving discover tab
  useEffect(() => {
    if (tab !== "discover") setSearchOpen(false);
  }, [tab]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [settingsOpen]);

  const handleLogout = async () => {
    setSettingsOpen(false);
    try {
      await logout();
    } catch {
      // clear locally even if API fails
    } finally {
      clearSession();
      setAuthed(false);
    }
  };

  const rightSlot =
    tab === "discover" ? (
      <button
        type="button"
        aria-label="Search"
        onClick={() => setSearchOpen((v) => !v)}
        className={`grid h-9 w-9 place-items-center rounded-full transition-colors ${
          searchOpen
            ? "bg-white/[0.08] text-white"
            : "text-mist-300 hover:bg-white/[0.04]"
        }`}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
          <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    ) : tab === "profile" ? (
      <div ref={settingsRef} className="relative">
        <button
          type="button"
          aria-label="Settings"
          onClick={() => setSettingsOpen((v) => !v)}
          className={`grid h-9 w-9 place-items-center rounded-full text-mist-300 hover:bg-white/[0.04] transition-colors ${settingsOpen ? "bg-white/[0.06] text-mist-500" : ""}`}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <AnimatePresence>
          {settingsOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-11 z-50 min-w-[160px] rounded-xl border border-white/10 bg-ink-100 py-1 shadow-xl backdrop-blur"
            >
              {authed ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-400 transition hover:bg-white/[0.05]"
                >
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
                    <path
                      d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Sign out
                </button>
              ) : (
                <p className="px-4 py-2.5 text-sm text-mist-200">Not signed in</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
              <CaptureScreen todaysPost={lastPost} onPosted={handlePosted} />
            ) : tab === "discover" ? (
              <DiscoverScreen
                todaysPost={lastPost}
                searchOpen={searchOpen}
                onSearchClose={() => setSearchOpen(false)}
              />
            ) : tab === "map" ? (
              <MapScreen />
            ) : tab === "graph" ? (
              <SocialGraphScreen />
            ) : (
              <ProfileScreen authed={authed} onAuthChange={setAuthed} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar active={tab} onChange={setTab} />
    </div>
  );
}