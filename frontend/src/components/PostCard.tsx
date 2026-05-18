import { motion } from "framer-motion";
import type { Post } from "../lib/api";
import { colorFor } from "../lib/categoryColor";
import { relativeTime } from "../lib/relativeTime";
import { Waveform } from "./Waveform";

interface Props {
  post: Post;
}

export function PostCard({ post }: Props) {
  const accent = colorFor(post.category);
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
      className="relative flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 backdrop-blur-sm"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 -top-px h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${accent}33, transparent)`,
        }}
      />

      <header className="flex items-start gap-4">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/[0.06]"
          style={{
            background: `radial-gradient(circle at 30% 30%, ${accent}26, transparent 70%)`,
          }}
        >
          <span className="text-3xl leading-none" aria-hidden>
            {post.emoji}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl italic leading-snug text-mist-400">
            {post.description}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-mist-100">
            {post.category.replace("_", " ")} · {relativeTime(post.created_at)}
            {post.is_mine ? " · yours" : ""}
          </p>
        </div>
      </header>

      {post.audio_url ? (
        <Waveform src={post.audio_url} color={accent} />
      ) : (
        <p className="text-xs text-mist-100">Audio unavailable.</p>
      )}
    </motion.article>
  );
}
