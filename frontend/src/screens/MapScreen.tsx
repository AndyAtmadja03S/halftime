import { useEffect, useState } from "react";
import { MapView } from "../components/MapView";
import { fetchFeed, fetchSimilarFeed, type Post } from "../lib/api";

type Mode = "all" | "friends" | "similar";

export function MapScreen() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("all");

  useEffect(() => {
    let alive = true;
    let req: ReturnType<typeof fetchFeed>;
    if (mode === "similar") req = fetchSimilarFeed();
    else if (mode === "friends") req = fetchFeed({ limit: 50, friends: true });
    else req = fetchFeed({ limit: 50 });
    req
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
  }, [mode]);

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setLoading(true);
    setError(false);
    setPosts([]);
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

      {/* Mode toggle */}
      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
        <div className="pointer-events-auto inline-flex rounded-full border border-white/[0.08] bg-[#0d0d12]/85 p-1 backdrop-blur-xl">
          <ModePill
            label="All"
            active={mode === "all"}
            onClick={() => changeMode("all")}
          />
          <ModePill
            label="Friends"
            active={mode === "friends"}
            onClick={() => changeMode("friends")}
          />
          <ModePill
            label="Similar"
            active={mode === "similar"}
            onClick={() => changeMode("similar")}
          />
        </div>
      </div>

      {loading ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 grid place-items-center">
          <p className="animate-pulse rounded-full border border-neutral-900 bg-neutral-950/60 px-3 py-1 text-[10px] tracking-widest text-neutral-400 uppercase backdrop-blur">
            Loading…
          </p>
        </div>
      ) : null}

      {!loading && mode === "similar" && posts.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 grid place-items-center">
          <p className="rounded-full border border-white/[0.08] bg-[#0d0d12]/80 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-mist-200 backdrop-blur">
            Post today to see similar atmospheres
          </p>
        </div>
      ) : null}

      {!loading && mode === "friends" && posts.length === 0 ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-30 grid place-items-center">
          <p className="rounded-full border border-white/[0.08] bg-[#0d0d12]/80 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-mist-200 backdrop-blur">
            No friends have posted yet
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ModePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.14em] transition " +
        (active
          ? "bg-white/[0.12] text-mist-400"
          : "text-mist-100 hover:text-mist-300")
      }
    >
      {label}
    </button>
  );
}
