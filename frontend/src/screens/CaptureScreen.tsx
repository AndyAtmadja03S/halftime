import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PostCard } from "../components/PostCard";
import { Recorder } from "../components/Recorder";
import { fetchFeed, type Post } from "../lib/api";

interface Props {
  hasPostedToday: boolean;
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

export function CaptureScreen({ hasPostedToday, todaysPost, onPosted }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFeed({ limit: 8 })
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => undefined)
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
    <div className="flex flex-col gap-5 px-4 pt-5 pb-10">
      <motion.div
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <Recorder
          hasPostedToday={hasPostedToday}
          todaysPost={todaysPost}
          onPosted={onPosted}
        />
      </motion.div>

      <section className="flex flex-col gap-3">
        <p className="px-1 text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
          Nearby Frequencies
        </p>
        {loading ? (
          <p className="px-1 text-xs text-mist-100">Tuning in…</p>
        ) : posts.length === 0 ? (
          <p className="px-1 text-xs text-mist-100">
            No one has spoken yet today.
          </p>
        ) : (
          posts.map((post) => <PostCard key={post.id} post={post} />)
        )}
      </section>
    </div>
  );
}
