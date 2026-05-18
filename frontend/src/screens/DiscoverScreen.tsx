import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MapView } from "../components/MapView";
import { Recorder } from "../components/Recorder";
import { fetchFeed, type Post } from "../lib/api";

interface Props {
  hasPostedToday: boolean;
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function DiscoverScreen({ hasPostedToday, todaysPost, onPosted }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFeed({ limit: 50 })
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => {
        // ignore
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!todaysPost) return;
    setPosts((prev) =>
      prev.some((p) => p.id === todaysPost.id) ? prev : [todaysPost, ...prev],
    );
  }, [todaysPost]);

  return (
    <div className="relative flex h-full flex-col">
      <div className="relative flex-1">
        <MapView posts={posts} />
        {loading ? (
          <div className="pointer-events-none absolute inset-x-0 top-4 grid place-items-center">
            <p className="rounded-full border border-line-200 bg-ink-100/70 px-3 py-1 text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase backdrop-blur">
              Tuning in…
            </p>
          </div>
        ) : null}
      </div>

      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 0.61, 0.36, 1] }}
        className="px-4 pt-4"
      >
        <Recorder
          hasPostedToday={hasPostedToday}
          todaysPost={todaysPost}
          onPosted={onPosted}
        />
      </motion.div>
    </div>
  );
}
