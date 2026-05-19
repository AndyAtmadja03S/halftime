import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type Post, uploadPost } from "../lib/api";
import { getCoordsOnce } from "../lib/geolocation";
import { blobToWav } from "../lib/wav";
import { LiveWaveform } from "./LiveWaveform";
import { Waveform } from "./Waveform";

const MAX_MS = 10_000;
const TICK_MS = 100;

type Phase = "idle" | "recording" | "review" | "uploading" | "done" | "error";

interface Props {
  todaysPost: Post | null;
  onPosted: (post: Post) => void;
}

function pickMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c;
    }
  }
  return "";
}

async function computeRms(blob: Blob): Promise<number | undefined> {
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)();
    const buf = await blob.arrayBuffer();
    const audio = await ctx.decodeAudioData(buf.slice(0));
    const ch = audio.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / ch.length);
    ctx.close();
    return Math.min(1, rms);
  } catch {
    return undefined;
  }
}

export function Recorder({ todaysPost, onPosted }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [reviewBlob, setReviewBlob] = useState<Blob | null>(null);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);
  const [shareLocation, setShareLocation] = useState(true);
  const [anonymous, setAnonymous] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const recordedDurationRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (stopTimerRef.current !== null) {
      window.clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
    setStream(null);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  // Revoke the blob preview URL whenever it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    };
  }, [reviewUrl]);

  const isBusy = phase === "recording" || phase === "uploading";

  const finalize = useCallback(
    async (blob: Blob, opts: { shareLocation: boolean; anonymous: boolean }) => {
      setPhase("uploading");
      setReviewUrl(null); // revoke preview URL (triggers effect cleanup)
      try {
        const durationMs = recordedDurationRef.current;
        const t1 = performance.now();
        const wavBlob = await blobToWav(blob);
        console.info("[voice] wav ready", {
          bytes: wavBlob.size,
          ms: Math.round(performance.now() - t1),
        });

        const [rms, coords] = await Promise.all([
          computeRms(blob),
          opts.shareLocation ? getCoordsOnce() : Promise.resolve(null),
        ]);
        console.info("[voice] metadata", {
          rms,
          coords: coords ? "granted" : "none/off",
          anonymous: opts.anonymous,
        });

        const { post } = await uploadPost(wavBlob, {
          durationMs,
          rms,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
          anonymous: opts.anonymous,
        });
        console.info("[voice] post created", { id: post.id, emoji: post.emoji });
        setPhase("done");
        onPosted(post);
      } catch (err) {
        console.error("[voice] finalize ✖ failed", err);
        const message =
          err instanceof ApiError && err.code === "upload_timeout"
            ? "Upload timed out. Try again."
            : "Couldn't upload. Try again.";
        setError(message);
        setPhase("error");
      }
    },
    [onPosted],
  );

  const start = useCallback(async () => {
    if (isBusy) return;
    setError(null);
    setReviewUrl(null);
    setReviewBlob(null);
    try {
      console.info("[voice] requesting microphone…");
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const track = s.getAudioTracks()[0];
      console.info("[voice] mic granted", {
        label: track?.label,
        settings: track?.getSettings?.(),
      });
      streamRef.current = s;
      setStream(s);
      const mimeType = pickMimeType();
      console.info("[voice] MediaRecorder mime", { mimeType: mimeType || "(default)" });
      const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          console.debug("[voice] chunk", { bytes: e.data.size });
        }
      };
      rec.onerror = (e) => {
        console.error("[voice] MediaRecorder error", e);
      };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        recordedDurationRef.current = Math.min(
          MAX_MS,
          Date.now() - startedAtRef.current,
        );
        console.info("[voice] recording stopped", {
          chunks: chunksRef.current.length,
          totalBytes: blob.size,
          elapsedMs: recordedDurationRef.current,
        });
        cleanup();
        // Go to review instead of uploading immediately.
        const url = URL.createObjectURL(blob);
        setReviewBlob(blob);
        setReviewUrl(url);
        setPhase("review");
      };
      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
      rec.start();
      console.info("[voice] recording started");

      tickRef.current = window.setInterval(() => {
        setElapsed(Math.min(MAX_MS, Date.now() - startedAtRef.current));
      }, TICK_MS);

      stopTimerRef.current = window.setTimeout(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          console.info("[voice] auto-stop at 10s cap");
          recorderRef.current.stop();
        }
      }, MAX_MS);
    } catch (err) {
      console.error("[voice] mic denied or failed", err);
      setError("Microphone access denied.");
      setPhase("error");
      cleanup();
    }
  }, [cleanup, isBusy]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      console.info("[voice] user stop");
      recorderRef.current.stop();
    }
  }, []);

  const retake = useCallback(() => {
    setReviewUrl(null);
    setReviewBlob(null);
    setElapsed(0);
    setPhase("idle");
  }, []);

  const upload = useCallback(() => {
    if (reviewBlob) void finalize(reviewBlob, { shareLocation, anonymous });
  }, [reviewBlob, finalize, shareLocation, anonymous]);

  const remainingS = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000));
  const remainingFrac = Math.max(0, (MAX_MS - elapsed) / MAX_MS);
  const durationS = (recordedDurationRef.current / 1000).toFixed(1);

  const showLastPost = (phase === "idle" || phase === "done") && !!todaysPost;
  const displayEmoji = showLastPost ? todaysPost!.emoji : "🎙️";
  const displayDescription =
    phase === "recording"
      ? "Ten seconds of where you are"
      : phase === "uploading"
        ? "Reading the room…"
        : phase === "error" && error
          ? error
          : (todaysPost?.description ?? "Hold a quiet moment. Share where you are.");

  const showToggles = phase === "idle" || phase === "review" || phase === "error";
  const showRings = phase === "idle" || phase === "recording" || phase === "uploading";
  const ringsAreFast = phase === "recording" || phase === "uploading";

  return (
    <div className="flex h-full flex-col py-8">

      {/* ── Stage (grows to fill vertical space, orb lives here) ── */}
      <div className="relative flex flex-1 items-center justify-center w-full">

        {/* Central orb — the only flex child, always perfectly centred */}
        <div className="relative grid h-44 w-44 place-items-center">
          {showRings &&
            [0, 1, 2].map((i) => (
              <SonarRing key={i} index={i} fast={ringsAreFast} />
            ))}
          <div
            className="relative z-10 grid h-44 w-44 place-items-center rounded-full border border-line-200 bg-ink-100/60 backdrop-blur-sm"
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={displayEmoji}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="select-none text-6xl leading-none"
              >
                {displayEmoji}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* Waveforms — absolutely positioned so they never push the orb */}
        <div className="absolute inset-x-0 bottom-0">
          {/* Live waveform + countdown (recording only) */}
          {phase === "recording" && (
            <div className="w-full">
              <LiveWaveform stream={stream} />
              <div className="relative mt-4 h-[3px] w-full overflow-hidden rounded-full bg-black-200">
                <motion.div
                  className="absolute inset-y-0 left-0 bg-mist-500"
                  initial={false}
                  animate={{ width: `${remainingFrac * 100}%` }}
                  transition={{ duration: 0.1, ease: "linear" }}
                />
              </div>
              <p className="mt-2 text-right text-[11px] tracking-[var(--tracking-chrome)] text-mist-300 uppercase">
                {remainingS}s remaining
              </p>
            </div>
          )}

          {/* Review waveform */}
          {phase === "review" && reviewUrl && (
            <div className="w-full">
              <p className="mb-3 text-center text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                Review · {durationS}s
              </p>
              <Waveform src={reviewUrl} color="rgba(255,255,255,0.6)" />
            </div>
          )}
        </div>

      </div>

      {/* ── Controls (anchored to bottom) ── */}
      <div className="flex flex-col items-center gap-5 w-full">

        {/* Description — always in layout to prevent height jumps */}
        <div
          className="text-center px-4 transition-opacity duration-300"
          style={{ opacity: phase === "recording" ? 0 : 1, pointerEvents: phase === "recording" ? "none" : undefined }}
        >
          <motion.p
            key={displayDescription}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="text-base text-mist-300"
          >
            {displayDescription}
          </motion.p>
          {todaysPost && (
            <p
              className="mt-1 text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase transition-opacity duration-300"
              style={{ opacity: showLastPost ? 1 : 0 }}
            >
              {todaysPost.category.replace("_", " ")} · last capture
            </p>
          )}
        </div>

        {/* Toggles — always in layout to prevent height jumps */}
        <div
          className="flex flex-wrap justify-center gap-2 transition-opacity duration-300"
          style={{ opacity: showToggles ? 1 : 0, pointerEvents: showToggles ? undefined : "none" }}
        >
          <ToggleChip
            icon={<LocationIcon />}
            label="Share location"
            active={shareLocation}
            onToggle={() => setShareLocation((v) => !v)}
          />
          <ToggleChip
            icon={<PersonIcon />}
            label="Anonymous"
            active={anonymous}
            onToggle={() => setAnonymous((v) => !v)}
          />
        </div>

        {/* Review: retake + upload */}
        {phase === "review" && (
          <div className="flex w-full gap-3">
            <button
              type="button"
              onClick={retake}
              className="flex-1 rounded-xl border border-line-200 px-5 py-4 text-sm font-medium tracking-[var(--tracking-chrome)] text-mist-300 uppercase transition hover:bg-white/[0.04] active:scale-95"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={upload}
              style={{ color: "var(--color-ink-300)" }}
              className="flex-[2] rounded-xl border border-mist-500 bg-mist-500 px-5 py-4 text-sm font-medium tracking-[var(--tracking-chrome)] uppercase transition hover:bg-mist-400 active:scale-95"
            >
              Upload
            </button>
          </div>
        )}

        {/* Main record / stop button */}
        {phase !== "review" && (
          <button
            type="button"
            onClick={phase === "recording" ? stop : start}
            disabled={phase === "uploading"}
            style={
              phase !== "recording" && phase !== "uploading"
                ? { color: "var(--color-ink-300)" }
                : undefined
            }
            className={clsx(
              "w-full rounded-xl border px-5 py-4 text-sm font-medium tracking-[var(--tracking-chrome)] uppercase transition active:scale-[0.98]",
              phase === "uploading"
                ? "border-line-100 bg-ink-200 text-mist-100"
                : phase === "recording"
                  ? "border-mist-500 bg-mist-500/10 text-mist-500"
                  : "border-mist-500 bg-mist-500 hover:bg-mist-400",
            )}
          >
            <AnimatePresence mode="wait">
              <motion.span
                key={phase}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {phase === "recording"
                  ? "Stop"
                  : phase === "uploading"
                    ? "Listening…"
                    : phase === "done"
                      ? "Record Again"
                      : phase === "error"
                        ? "Try Again"
                        : "Start Recording"}
              </motion.span>
            </AnimatePresence>
          </button>
        )}

      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function SonarRing({ index, fast }: { index: number; fast: boolean }) {
  const duration = fast ? 1.0 : 2.6;
  const delay = (index * duration) / 3;
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 rounded-full border border-white/20"
      animate={{ scale: [1, 2.8], opacity: [0.6, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

function ToggleChip({
  icon,
  label,
  active,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={clsx(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-mist-400/40 bg-mist-500/15 text-mist-400"
          : "border-line-100 bg-transparent text-mist-100",
      )}
    >
      {icon}
      {label}
      {/* mini toggle switch */}
      <span
        className={clsx(
          "relative inline-flex h-3 w-5 shrink-0 items-center rounded-full border transition-colors duration-200",
          active ? "border-mist-400/60 bg-mist-500/40" : "border-line-200 bg-ink-200",
        )}
      >
        <span
          className={clsx(
            "absolute h-2 w-2 rounded-full transition-all duration-200",
            active ? "left-[9px] bg-mist-400" : "left-[1px] bg-mist-100",
          )}
        />
      </span>
    </button>
  );
}

function LocationIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1-4 4-6 8-6s7 2 8 6" />
    </svg>
  );
}
