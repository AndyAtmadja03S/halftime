import { useEffect, useState } from "react";
import { MapView } from "../components/MapView";
import { fetchFeed, type Post } from "../lib/api";

export function MapScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchFeed({ limit: 50 })
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-ink-0">
        <p className="animate-pulse rounded-full border border-neutral-900 bg-neutral-950/40 px-3 py-1 text-[10px] tracking-widest text-neutral-400 uppercase backdrop-blur">
          Loading map…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-ink-0">
        <p className="rounded-full border border-red-900/60 bg-red-950/40 px-3 py-1 text-[10px] tracking-widest text-red-400 uppercase backdrop-blur">
          Could not connect — is the backend running?
        </p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      <MapView posts={posts} />
    </div>
  );
}
