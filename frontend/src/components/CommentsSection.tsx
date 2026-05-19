import { useEffect, useRef, useState } from "react";
import {
  type Comment,
  createComment,
  deleteComment,
  fetchComments,
} from "../lib/api";
import { relativeTime } from "../lib/relativeTime";

interface Props {
  postId: string;
  onCountChange?: (delta: number) => void;
}

const MAX_LENGTH = 280;

export function CommentsSection({ postId, onCountChange }: Readonly<Props>) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetchComments(postId)
      .then((res) => {
        if (alive) setComments(res.comments);
      })
      .catch(() => {
        if (alive) setError("Couldn't load comments");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [postId]);

  const handleReplyTo = (handle: string | null) => {
    if (!handle) return;
    const mention = `@${handle} `;
    setBody((prev) => (prev.startsWith(mention) ? prev : mention + prev));
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await createComment(postId, trimmed, anonymous);
      setComments((prev) => [...prev, res.comment]);
      setBody("");
      onCountChange?.(1);
    } catch {
      setError("Couldn't post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    const prev = comments;
    setComments((cs) => cs.filter((c) => c.id !== commentId));
    try {
      await deleteComment(postId, commentId);
      onCountChange?.(-1);
    } catch {
      setComments(prev);
      setError("Couldn't delete comment");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs uppercase tracking-wider text-mist-200">
        Comments
      </p>

      <div className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-mist-200">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-mist-200">
            No comments yet. Be the first to leave one.
          </p>
        ) : (
          comments.map((c) => {
            const displayHandle = c.is_anonymous
              ? "anon"
              : c.handle
                ? `@${c.handle}`
                : "anon";
            return (
              <div
                key={c.id}
                className="rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-mist-200">
                  <span>
                    {c.is_mine ? "you" : displayHandle}
                    <span className="mx-1">·</span>
                    {relativeTime(c.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {!c.is_anonymous && c.handle && !c.is_mine && (
                      <button
                        type="button"
                        onClick={() => handleReplyTo(c.handle)}
                        className="text-mist-200 hover:text-mist-500"
                      >
                        Reply
                      </button>
                    )}
                    {c.is_mine && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="text-mist-200 hover:text-rose-300"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1 break-words text-[13px] leading-snug text-mist-500">
                  {c.body}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          ref={inputRef}
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
          placeholder="Leave a quiet note…"
          rows={2}
          className="resize-none rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[13px] text-mist-500 placeholder:text-mist-200 focus:border-white/20 focus:outline-none"
        />
        <div className="flex items-center justify-between text-[11px] text-mist-200">
          <label className="flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="h-3.5 w-3.5 accent-white/60"
            />
            <span>Anonymous</span>
          </label>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">
              {body.length}/{MAX_LENGTH}
            </span>
            <button
              type="submit"
              disabled={!body.trim() || submitting}
              className="rounded-md border border-white/10 bg-white/[0.06] px-3 py-1 font-medium text-mist-500 transition hover:bg-white/[0.12] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
        {error && <p className="text-[11px] text-rose-300">{error}</p>}
      </form>
    </div>
  );
}
