import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { CommentsSection } from "./CommentsSection";
import { Waveform } from "./Waveform";
import { colorFor } from "../lib/categoryColor";
import { relativeTime } from "../lib/relativeTime";
import { reverseGeocode } from "../lib/reverseGeocode";
import { sendFriendRequestByHandle, ApiError } from "../lib/api";
import type { Post } from "../lib/api";

interface Props {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onCommentCountChange?: (postId: string, delta: number) => void;
  addedHandles?: Set<string>;
  onHandleAdded?: (handle: string) => void;
}

export function SoundDetailModal({
  post,
  isOpen,
  onClose,
  onCommentCountChange,
  addedHandles,
  onHandleAdded,
}: Readonly<Props>) {
  if (!post) return null;

  const accent = colorFor(post.category);

  return (
    <SoundDetailModalInner
      post={post}
      isOpen={isOpen}
      onClose={onClose}
      accent={accent}
      onCommentCountChange={onCommentCountChange}
      addedHandles={addedHandles}
      onHandleAdded={onHandleAdded}
    />
  );
}

function AddFriendButton({
  handle,
  initialAdded,
  onAdded,
}: {
  handle: string;
  initialAdded: boolean;
  onAdded?: (handle: string) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "added">(
    initialAdded ? "added" : "idle"
  );

  // Keep in sync if parent learns the handle was already added
  useEffect(() => {
    if (initialAdded) setState("added");
  }, [initialAdded]);

  const add = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      await sendFriendRequestByHandle(handle);
      setState("added");
      onAdded?.(handle);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        (err.code === "already_friends" || err.code === "request_already_sent")
      ) {
        setState("added");
        onAdded?.(handle);
      } else {
        setState("idle");
      }
    }
  };

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-xs text-mist-300 tracking-wide">@{handle}</span>
      <button
        onClick={add}
        disabled={state !== "idle"}
        className={`rounded-full border px-3 py-1 text-[11px] font-medium transition active:scale-95 ${
          state === "added"
            ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
            : "border-white/20 bg-white/[0.12] text-white/80 hover:bg-white/[0.20] hover:text-white"
        }`}
      >
        {state === "loading" ? "Adding…" : state === "added" ? "✓ Added" : "+ Add friend"}
      </button>
    </div>
  );
}

function SoundDetailModalInner({
  post,
  isOpen,
  onClose,
  accent,
  onCommentCountChange,
  addedHandles,
  onHandleAdded,
}: {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  accent: string;
  onCommentCountChange?: (postId: string, delta: number) => void;
  addedHandles?: Set<string>;
  onHandleAdded?: (handle: string) => void;
}) {
  const [locationLabel, setLocationLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!post.latitude || !post.longitude) return;
    setLocationLabel(null);
    let cancelled = false;
    reverseGeocode(post.latitude, post.longitude).then((label) => {
      if (!cancelled) setLocationLabel(label);
    });
    return () => { cancelled = true; };
  }, [post.latitude, post.longitude]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-4 z-50 flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-ink-100 to-ink-0 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-sm md:max-h-[90vh] md:-translate-x-1/2 md:-translate-y-1/2"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
              {/* Header with emoji background */}
              <div
                className="relative -mx-6 -mt-6 flex flex-col items-center justify-center gap-4 rounded-t-3xl px-6 py-12"
                style={{
                  background: `radial-gradient(circle at 50% 0%, ${accent}40, transparent 70%), linear-gradient(to bottom, ${accent}20, transparent)`,
                }}
              >
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 grid h-7 w-7 place-items-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                  aria-label="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                  </svg>
                </button>

                <div
                  className="grid h-24 w-24 place-items-center rounded-full border-2 border-white/20"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${accent}40, transparent 70%)`,
                  }}
                >
                  <span className="text-6xl leading-none" aria-hidden>
                    {post.emoji}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex flex-col items-center gap-1">
                <h2 className="text-center text-2xl font-bold text-mist-500">
                  {post.description}
                </h2>
                <p className="text-center text-sm uppercase tracking-wider text-mist-200">
                  {post.category.replace(/_/g, " ")}
                </p>

                {!post.is_mine && post.handle && (
                  <AddFriendButton
                    handle={post.handle}
                    initialAdded={addedHandles?.has(post.handle) ?? false}
                    onAdded={onHandleAdded}
                  />
                )}
              </div>

              {/* Metadata */}
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-xs">
                <div>
                  <p className="text-mist-300">Duration</p>
                  <p className="text-mist-500 font-semibold">
                    {(post.duration_ms / 1000).toFixed(1)}s
                  </p>
                </div>
                {(post.handle || post.is_mine) && (
                  <div className="text-center">
                    <p className="text-mist-300">Posted by</p>
                    <p className="text-mist-500 font-semibold">
                      {post.is_mine ? "you" : `@${post.handle}`}
                    </p>
                  </div>
                )}
                <div className="text-right">
                  <p className="text-mist-300">Captured</p>
                  <p className="text-mist-500 font-semibold">
                    {relativeTime(post.created_at)}
                  </p>
                </div>
              </div>

              {/* Waveform */}
              {post.audio_url ? (
                <div>
                  <p className="mb-2 text-xs uppercase tracking-wider text-mist-200">
                    Listen
                  </p>
                  <Waveform src={post.audio_url} color={accent} />
                </div>
              ) : (
                <p className="text-xs text-mist-100">Audio unavailable.</p>
              )}

              {/* Location */}
              {post.latitude && post.longitude && (
                <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-xs">
                  <p className="text-mist-300">Location</p>
                  <p className="mt-1 text-mist-500 text-[11px]">
                    {locationLabel ?? "Locating…"}
                  </p>
                </div>
              )}

              {/* Comments */}
              <CommentsSection
                postId={post.id}
                onCountChange={(delta) =>
                  onCommentCountChange?.(post.id, delta)
                }
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}