import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Recorder } from "../components/Recorder";
import { fetchTodayStatus, type Post } from "../lib/api";
import { isLoggedIn } from "../lib/auth";

interface Props {
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function CaptureScreen({ todaysPost, onPosted }: Props) {
  const [hasPostedToday, setHasPostedToday] = useState<boolean>(!!todaysPost);

  useEffect(() => {
    if (todaysPost) {
      setHasPostedToday(true);
      return;
    }
    if (!isLoggedIn()) {
      setHasPostedToday(false);
      return;
    }
    let cancelled = false;
    fetchTodayStatus()
      .then((s) => {
        if (!cancelled) setHasPostedToday(s.hasPostedToday);
      })
      .catch(() => {
        if (!cancelled) setHasPostedToday(false);
      });
    return () => {
      cancelled = true;
    };
  }, [todaysPost]);

  return (
    <div className="h-full px-5">
      <motion.div
        className="flex h-full flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {hasPostedToday && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-mist-400/40 bg-mist-500/15 px-4 py-2 text-xs font-medium tracking-[var(--tracking-chrome)] text-mist-400 uppercase"
          >
            <CheckIcon />
            You've already shared today
          </motion.div>
        )}
        <div className="flex-1 min-h-0">
          <Recorder todaysPost={todaysPost} onPosted={onPosted} />
        </div>
      </motion.div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
