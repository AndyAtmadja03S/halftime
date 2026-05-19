import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Waveform } from "./Waveform";
import { colorFor } from "../lib/categoryColor";
import { relativeTime } from "../lib/relativeTime";
import { reverseGeocode } from "../lib/reverseGeocode";
import type { Post } from "../lib/api";

interface Props {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SoundDetailModal({ post, isOpen, onClose }: Props) {
  if (!post) return null;

  const accent = colorFor(post.category);

  return <SoundDetailModalInner post={post} isOpen={isOpen} onClose={onClose} accent={accent} />;
}

function SoundDetailModalInner({
  post,
  isOpen,
  onClose,
  accent,
}: { post: Post; isOpen: boolean; onClose: () => void; accent: string }) {
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
            className="fixed inset-4 z-50 flex flex-col gap-6 rounded-3xl border border-white/10 bg-gradient-to-b from-ink-100 to-ink-0 p-6 shadow-2xl md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-sm md:-translate-x-1/2 md:-translate-y-1/2"
          >
            {/* Header with emoji background */}
            <div
              className="relative -mx-6 -mt-6 flex flex-col items-center justify-center gap-4 rounded-t-3xl px-6 py-12"
              style={{
                background: `radial-gradient(circle at 50% 0%, ${accent}40, transparent 70%), linear-gradient(to bottom, ${accent}20, transparent)`,
              }}
            >
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
            <div className="flex flex-col gap-1">
              <h2 className="text-center text-2xl font-bold text-mist-500">
                {post.description}
              </h2>
              <p className="text-center text-sm uppercase tracking-wider text-mist-200">
                {post.category.replace(/_/g, " ")}
              </p>
            </div>

            {/* Metadata */}
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-xs">
              <div>
                <p className="text-mist-300">Duration</p>
                <p className="text-mist-500 font-semibold">
                  {(post.duration_ms / 1000).toFixed(1)}s
                </p>
              </div>
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

            {/* Location (if available) */}
            {post.latitude && post.longitude && (
              <div className="rounded-lg border border-white/5 bg-white/[0.03] px-4 py-3 text-xs">
                <p className="text-mist-300">Location</p>
                <p className="mt-1 text-mist-500 text-[11px]">
                  {locationLabel ?? "Locating…"}
                </p>
              </div>
            )}

            {/* Close button */}
            <button
              onClick={onClose}
              className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] py-2 text-sm font-medium text-mist-300 transition hover:bg-white/[0.08] active:scale-95"
            >
              Close
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
