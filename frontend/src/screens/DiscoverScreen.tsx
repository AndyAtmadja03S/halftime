import { useEffect, useRef, useState } from "react";
import { fetchFeed, type Post } from "../lib/api";
import { SoundDetailModal } from "../components/SoundDetailModal";

interface Props {
  todaysPost: Post | null;
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;

const CATEGORY_FALLBACK_EMOJI: Record<string, string> = {
  rain: "🌧️",
  cafe: "☕",
  commute: "🚇",
  city_night: "🌃",
  nature: "🌿",
  ocean: "🌊",
  quiet: "💤",
  crowd: "🔥",
  other: "🌫️",
};

function safeEmoji(post: Post): string {
  if (post.emoji && EMOJI_RE.test(post.emoji)) return post.emoji;
  return CATEGORY_FALLBACK_EMOJI[post.category] ?? "🌫️";
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ").toUpperCase();
}

function formatRelativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "NOW";
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "NOW";
  if (m < 60) return `${m}M`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}D`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}W`;
  const mo = Math.floor(d / 30);
  return `${mo}MO`;
}

export function DiscoverScreen({ todaysPost }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendsOnly, setFriendsOnly] = useState(false);

  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFeed({ limit: 50 })
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlaySound = async (postId: string, audioUrl: string | null) => {
    if (!audioUrl) return;

    if (playingPostId === postId && audioRef.current) {
      audioRef.current.pause();
      setPlayingPostId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    audio.onended = () => {
      if (audioRef.current === audio) setPlayingPostId(null);
    };

    try {
      await audio.play();
      if (audioRef.current === audio) {
        setPlayingPostId(postId);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return;
      }
      console.error("Audio playback failed:", err);
      if (audioRef.current === audio) {
        setPlayingPostId(null);
      }
    }
  };

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const visiblePosts = friendsOnly
    ? posts.filter((p) => p.is_mine)
    : posts;

  return (
    <div className="relative flex h-full flex-col bg-black font-sans text-white antialiased overflow-x-hidden">
      <div className="flex gap-2 px-4 pt-3 pb-2">
      <button
        type="button"
        onClick={() => setFriendsOnly(false)}
        className={`rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-wider uppercase transition-colors duration-200 ${
          !friendsOnly
            ? "bg-neutral-600 text-white"
            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
        }`}
      >
        Everyone
      </button>
      <button
        type="button"
        onClick={() => setFriendsOnly(true)}
        className={`rounded-full px-4 py-1.5 text-[12px] font-semibold tracking-wider uppercase transition-colors duration-200 ${
          friendsOnly
            ? "bg-neutral-600 text-white"
            : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
        }`}
      >
        Friends
      </button>
    </div>

      <div className="flex-1 space-y-[11px] overflow-y-auto overflow-x-hidden px-4 pt-1 pb-8">
        {loading ? (
          <div className="grid h-48 place-items-center">
            <p className="animate-pulse rounded-full border border-neutral-900 bg-neutral-950/40 px-3 py-1 text-[10px] tracking-widest text-neutral-400 uppercase backdrop-blur">
              Tuning in…
            </p>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="grid h-48 place-items-center">
            <p className="rounded-full border border-neutral-900 bg-neutral-950/40 px-3 py-1 text-[10px] tracking-widest text-neutral-400 uppercase backdrop-blur">
              {friendsOnly
                ? "None of your friends have posted yet"
                : "No one has spoken yet today"}
            </p>
          </div>
        ) : (
          visiblePosts.map((post, index) => {
            const isCurrentlyPlaying = playingPostId === post.id;
            const canPlay = post.audio_url !== null;
            const accountLabel = post.is_mine
              ? `You · ${post.description}`
              : post.description;

            return (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="relative flex min-h-[92px] rounded-[24px] bg-[#121212] p-4 cursor-pointer transition-all duration-200 hover:bg-[#1a1a1a] active:scale-[0.98]"
              >
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden text-[34px] leading-none select-none">
                  <span aria-hidden>{safeEmoji(post)}</span>
                </div>

                <div className="flex flex-1 flex-col justify-center pr-6 pl-4">
                  <h3 className="truncate text-[15px] font-normal tracking-wide text-[#f3f3f3]">
                    {accountLabel}
                  </h3>

                  <div className="mt-[7px] flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySound(post.id, post.audio_url);
                      }}
                      disabled={!canPlay}
                      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-neutral-800 text-white transition duration-150 hover:bg-neutral-700 active:scale-95 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-neutral-800"
                      aria-label={
                        !canPlay
                          ? "Audio unavailable"
                          : isCurrentlyPlaying
                            ? "Pause sound"
                            : "Play sound"
                      }
                    >
                      {isCurrentlyPlaying ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                          stroke="currentColor"
                          className="h-3 w-3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          className="ml-0.5 h-3 w-3"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 5.653c0-1.427 1.529-2.33 2.779-1.643l11.54 6.347c1.295.712 1.295 2.573 0 3.286L7.28 19.99c-1.25.687-2.779-.217-2.779-1.643V5.653Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>

                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <div className="flex h-[18px] min-w-0 flex-1 items-center gap-[2.5px] overflow-hidden">
                        {Array.from({ length: 16 }).map((_, i) => {
                          const waveSeed =
                            (((index + 1) * (i + 3) * 7) % 9) + 3;
                          return (
                            <div
                              key={i}
                              style={{
                                height: `${waveSeed * 1.5}px`,
                                animationDelay: `${i * 0.04}s`,
                              }}
                              className={`w-[2px] flex-shrink-0 rounded-full transition-all duration-300 ${
                                isCurrentlyPlaying
                                  ? "animate-[pulse_0.6s_infinite_alternate] bg-white opacity-100"
                                  : "bg-[#9a9a9f] opacity-90"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <div className="shrink-0 text-[11px] font-bold tracking-wider whitespace-nowrap text-[#636366] uppercase">
                        <span>{formatCategory(post.category)}</span>
                        <span className="mx-1">•</span>
                        <span>{formatRelativeTime(post.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-1/2 right-[18px] -translate-y-1/2 p-1 text-[#545456] transition-colors duration-200 hover:text-white"
                  aria-label="More options"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="h-[18px] w-[18px]"
                  >
                    <path d="M12 10.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm7 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm-14 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      <SoundDetailModal
        post={selectedPost}
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
      />
    </div>
  );
}