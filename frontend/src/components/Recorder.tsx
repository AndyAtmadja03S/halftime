import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type Post, uploadPost } from "../lib/api";
import { getDeviceHour } from "../lib/deviceId";
import { getCoordsOnce } from "../lib/geolocation";
import { LiveWaveform } from "./LiveWaveform";

const MAX_MS = 10_000;
const TICK_MS = 100;
const START_HOUR = 9;
const END_HOUR = 21;

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

interface Props {
  hasPostedToday: boolean;
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

export function Recorder({ hasPostedToday, todaysPost, onPosted }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hour, setHour] = useState(getDeviceHour());
  const [stream, setStream] = useState<MediaStream | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setHour(getDeviceHour()), 60_000);
    return () => window.clearInterval(id);
  }, []);

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

  const inWindow = hour >= START_HOUR && hour < END_HOUR;
  const locked = hasPostedToday || phase === "done";

  const finalize = useCallback(
    async (blob: Blob) => {
      setPhase("uploading");
      try {
        const durationMs = Math.min(MAX_MS, Date.now() - startedAtRef.current);
        console.info("[voice] finalize → blob ready", {
          bytes: blob.size,
          mime: blob.type,
          durationMs,
        });
        const [rms, coords] = await Promise.all([
          computeRms(blob),
          getCoordsOnce(),
        ]);
        console.info("[voice] finalize ← metadata", {
          rms,
          coords: coords ? "granted" : "denied/none",
        });
        const { post } = await uploadPost(blob, {
          durationMs,
          rms,
          latitude: coords?.latitude,
          longitude: coords?.longitude,
        });
        console.info("[voice] post created", {
          id: post.id,
          emoji: post.emoji,
          category: post.category,
          description: post.description,
        });
        setPhase("done");
        onPosted(post);
      } catch (err) {
        console.error("[voice] finalize ✖ failed", err);
        const message =
          err instanceof ApiError
            ? err.code === "outside_window"
              ? "Outside the 9pm window."
              : err.code === "already_posted_today"
                ? "You've already shared today."
                : "Couldn't upload. Try again."
            : "Couldn't upload. Try again.";
        setError(message);
        setPhase("error");
      }
    },
    [onPosted],
  );

  const start = useCallback(async () => {
    if (locked || !inWindow) {
      console.warn("[voice] start blocked", { locked, inWindow });
      return;
    }
    setError(null);
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
        console.info("[voice] recording stopped", {
          chunks: chunksRef.current.length,
          totalBytes: blob.size,
          elapsedMs: Date.now() - startedAtRef.current,
        });
        cleanup();
        void finalize(blob);
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
  }, [cleanup, finalize, inWindow, locked]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      console.info("[voice] user stop");
      recorderRef.current.stop();
    }
  }, []);

  const remainingS = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000));

  let buttonLabel = "Capture";
  let buttonDisabled = false;
  if (!inWindow) {
    buttonLabel = "Quiet Hours";
    buttonDisabled = true;
  } else if (locked) {
    buttonLabel = "Shared Today";
    buttonDisabled = true;
  } else if (phase === "recording") {
    buttonLabel = `Stop · ${remainingS}s`;
  } else if (phase === "uploading") {
    buttonLabel = "Listening…";
    buttonDisabled = true;
  } else if (phase === "error" && error) {
    buttonLabel = "Try Again";
  }

  const displayEmoji = todaysPost?.emoji ?? "🎙️";
  const displayDescription =
    todaysPost?.description ??
    (phase === "recording"
      ? "Ten seconds of where you are"
      : phase === "uploading"
        ? "Reading the room…"
        : error ??
          "Hold a quiet moment. Share where you are.");

  return (
    <div className="flex w-full flex-col items-stretch gap-4 rounded-2xl border border-line-200 bg-ink-100/70 p-6 backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <motion.div
          layout
          className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-line-200 bg-ink-200"
          aria-hidden
        >
          <span className="text-3xl leading-none">{displayEmoji}</span>
        </motion.div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm leading-snug text-mist-300">
            {displayDescription}
          </p>
          {todaysPost ? (
            <p className="mt-1 text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
              {todaysPost.category.replace("_", " ")} · today
            </p>
          ) : null}
        </div>
      </div>

      <div className="px-1">
        <LiveWaveform stream={phase === "recording" ? stream : null} />
      </div>

      <button
        type="button"
        onClick={phase === "recording" ? stop : start}
        disabled={buttonDisabled}
        className={clsx(
          "relative grid place-items-center rounded-lg border px-5 py-3 text-xs tracking-[var(--tracking-chrome)] uppercase transition",
          buttonDisabled
            ? "border-line-100 text-mist-100"
            : "border-mist-300 text-mist-500 hover:bg-white/[0.04]",
          phase === "recording" && "border-mist-500 text-mist-500",
        )}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={buttonLabel}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {buttonLabel}
          </motion.span>
        </AnimatePresence>
        {phase === "recording" ? (
          <motion.span
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-mist-500"
            initial={false}
            animate={{ scaleX: elapsed / MAX_MS }}
            style={{ transformOrigin: "left" }}
            transition={{ duration: 0.1, ease: "linear" }}
          />
        ) : null}
      </button>
    </div>
  );
}
