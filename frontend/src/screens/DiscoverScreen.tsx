import { useEffect, useRef, useState } from "react";
import {
  fetchFeed,
  votePost,
  type FeedSort,
  type Post,
  type VoteValue,
} from "../lib/api";
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

function formatScore(score: number): string {
  if (score === 0) return "0";
  const abs = Math.abs(score);
  if (abs < 1000) return String(score);
  const k = (score / 1000).toFixed(1).replace(/\.0$/, "");
  return `${k}K`;
}

const SORT_TABS: { value: FeedSort; label: string }[] = [
  { value: "hot", label: "Hot" },
  { value: "new", label: "New" },
  { value: "top", label: "Top" },
];

export function DiscoverScreen({ todaysPost }: Readonly<Props>) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [sort, setSort] = useState<FeedSort>("hot");

  const [playingPostId, setPlayingPostId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFeed({ limit: 50, friends: friendsOnly, sort })
      .then((res) => {
        if (alive) setPosts(res.posts);
      })
      .catch(() => {
        if (alive) setPosts([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [friendsOnly, sort]);

  useEffect(() => {
    if (!todaysPost || friendsOnly) return;
    setPosts((prev) =>
      prev.some((p) => p.id === todaysPost.id) ? prev : [todaysPost, ...prev],
    );
  }, [todaysPost, friendsOnly]);

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

  const handleVote = async (post: Post, direction: 1 | -1) => {
    const next: VoteValue = post.my_vote === direction ? 0 : direction;
    const delta = next - post.my_vote;
    const optimistic: Post = {
      ...post,
      my_vote: next,
      score: post.score + delta,
      upvotes:
        post.upvotes +
        (next === 1 ? 1 : 0) -
        (post.my_vote === 1 ? 1 : 0),
      downvotes:
        post.downvotes +
        (next === -1 ? 1 : 0) -
        (post.my_vote === -1 ? 1 : 0),
    };
    setPosts((prev) => prev.map((p) => (p.id === post.id ? optimistic : p)));
    try {
      const res = await votePost(post.id, next);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                upvotes: res.upvotes,
                downvotes: res.downvotes,
                score: res.score,
                my_vote: res.my_vote,
              }
            : p,
        ),
      );
    } catch (err) {
      console.error("Vote failed:", err);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    }
  };

  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const visiblePosts = posts;

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

      <div className="flex gap-1 px-4 pb-2">
        {SORT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSort(tab.value)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-wider uppercase transition-colors duration-200 ${
              sort === tab.value
                ? "bg-white/10 text-white"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
            const scoreColor =
              post.score > 0
                ? "text-emerald-400"
                : post.score < 0
                  ? "text-rose-400"
                  : "text-neutral-400";

            return (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="relative flex rounded-2xl bg-[#111] cursor-pointer transition-all duration-200 hover:bg-[#191919] active:scale-[0.98]"
              >
                <div className="flex flex-1 gap-3 px-4 py-3.5 min-w-0">
                  {/* Emoji bubble */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[24px] leading-none select-none">
                    <span aria-hidden>{safeEmoji(post)}</span>
                  </div>

                  <div className="flex flex-1 flex-col min-w-0 gap-[6px]">
                    {/* Description + meta row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium leading-snug text-[#f0f0f0]">
                          {post.description}
                        </p>
                        <p className="mt-0.5 text-[11px] tracking-wider text-[#4a4a4e] uppercase">
                          {post.is_mine
                            ? "you"
                            : post.handle
                              ? `@${post.handle}`
                              : "anon"}
                          <span className="mx-1">·</span>
                          {formatCategory(post.category)}
                          <span className="mx-1">·</span>
                          {formatRelativeTime(post.created_at)}
                        </p>
                      </div>

                      {/* Vote stack */}
                      <div
                        className="flex shrink-0 items-center gap-1 rounded-full bg-white/[0.04] px-1.5 py-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => handleVote(post, 1)}
                          aria-label="Upvote"
                          aria-pressed={post.my_vote === 1}
                          className={`grid h-6 w-6 place-items-center rounded-full transition-colors duration-150 ${
                            post.my_vote === 1
                              ? "text-emerald-400"
                              : "text-neutral-500 hover:text-emerald-300"
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M12 4l8 9h-5v7H9v-7H4l8-9z" />
                          </svg>
                        </button>
                        <span
                          className={`min-w-[18px] text-center text-[11px] font-semibold tabular-nums ${scoreColor}`}
                        >
                          {formatScore(post.score)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleVote(post, -1)}
                          aria-label="Downvote"
                          aria-pressed={post.my_vote === -1}
                          className={`grid h-6 w-6 place-items-center rounded-full transition-colors duration-150 ${
                            post.my_vote === -1
                              ? "text-rose-400"
                              : "text-neutral-500 hover:text-rose-300"
                          }`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-3.5 w-3.5"
                          >
                            <path d="M12 20l-8-9h5V4h6v7h5l-8 9z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Waveform row */}
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySound(post.id, post.audio_url);
                        }}
                        disabled={!canPlay}
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-white transition duration-150 hover:bg-white/[0.12] active:scale-95 focus:outline-none disabled:cursor-not-allowed disabled:opacity-30"
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

                      <div className="flex flex-1 h-[16px] items-center gap-[2.5px] overflow-hidden">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const waveSeed =
                            (((index + 1) * (i + 3) * 7) % 9) + 3;
                          return (
                            <div
                              key={i}
                              style={{
                                height: `${waveSeed * 1.5}px`,
                                animationDelay: `${i * 0.04}s`,
                              }}
                              className={`w-[2px] shrink-0 rounded-full transition-all duration-300 ${
                                isCurrentlyPlaying
                                  ? "animate-[pulse_0.6s_infinite_alternate] bg-white opacity-90"
                                  : "bg-white/20"
                              }`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
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
