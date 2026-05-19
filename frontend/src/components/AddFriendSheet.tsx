import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ApiError, sendFriendRequest } from "../lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Result =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; status: "pending" | "accepted" }
  | { kind: "error"; message: string };

const ERROR_COPY: Record<string, string> = {
  invalid_code: "That doesn't look like a valid code.",
  code_not_found: "No one with that code.",
  cannot_friend_self: "That's your own code.",
  already_friends: "You're already friends.",
  request_already_sent: "Request already sent.",
};

function formatInput(raw: string): string {
  const stripped = raw.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 8);
  if (stripped.length <= 4) return stripped;
  return `${stripped.slice(0, 4)}-${stripped.slice(4)}`;
}

export function AddFriendSheet({ isOpen, onClose, onSuccess }: Props) {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  useEffect(() => {
    if (!isOpen) {
      setCode("");
      setResult({ kind: "idle" });
    }
  }, [isOpen]);

  useEffect(() => {
    if (result.kind !== "success") return;
    const t = window.setTimeout(() => {
      onSuccess();
      onClose();
    }, 1200);
    return () => window.clearTimeout(t);
  }, [result, onClose, onSuccess]);

  const raw = code.replace(/-/g, "");
  const ready = raw.length === 8 && result.kind !== "submitting";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setResult({ kind: "submitting" });
    try {
      const { status } = await sendFriendRequest(raw);
      setResult({ kind: "success", status });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "unknown";
      setResult({
        kind: "error",
        message: ERROR_COPY[code] ?? "Something went wrong. Try again.",
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[18%] z-50 mx-auto flex max-w-sm flex-col gap-5 rounded-3xl border border-white/10 bg-gradient-to-b from-ink-100 to-ink-0 p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-xl font-semibold text-mist-500">Add a friend</h2>
              <p className="mt-1 text-sm text-mist-200">
                Enter their 8-character code.
              </p>
            </div>

            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                  Friend code
                </span>
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={code}
                  onChange={(e) => setCode(formatInput(e.target.value))}
                  className="rounded-lg border border-line-200 bg-ink-200 px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em] text-mist-500 outline-none focus:border-mist-500"
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  required
                />
              </label>

              {result.kind === "error" ? (
                <p className="text-sm text-red-400/90">{result.message}</p>
              ) : result.kind === "success" ? (
                <p className="text-sm text-mist-400">
                  {result.status === "accepted"
                    ? "You're now friends."
                    : "Request sent — they need to accept."}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={!ready}
                style={{ color: "var(--color-ink-300)" }}
                className={clsx(
                  "mt-1 rounded-lg border border-mist-500 bg-mist-500 px-5 py-3 text-sm font-medium tracking-[var(--tracking-chrome)] uppercase transition",
                  !ready && "opacity-60",
                )}
              >
                {result.kind === "submitting" ? "Sending…" : "Send request"}
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
