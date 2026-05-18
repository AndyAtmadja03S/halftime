import { useCallback, useEffect, useRef, useState } from "react";

const MAX_MS = 10_000;

interface Result {
  bytes: number;
  mime: string;
  durationMs: number;
  rms: number | null;
  sampleRate: number | null;
  channels: number | null;
  url: string;
}

function pickMime(): string {
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

async function analyze(blob: Blob): Promise<{
  rms: number | null;
  sampleRate: number | null;
  channels: number | null;
}> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const buf = await blob.arrayBuffer();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    const ch = decoded.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < ch.length; i++) sum += ch[i] * ch[i];
    const rms = Math.sqrt(sum / ch.length);
    void ctx.close();
    return {
      rms: Math.min(1, rms),
      sampleRate: decoded.sampleRate,
      channels: decoded.numberOfChannels,
    };
  } catch (err) {
    console.warn("[mic-test] analyze failed", err);
    return { rms: null, sampleRate: null, channels: null };
  }
}

export function MicTest() {
  const [phase, setPhase] = useState<"idle" | "recording" | "analyzing" | "done" | "error">(
    "idle",
  );
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const recRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const append = useCallback((line: string, extra?: unknown) => {
    const ts = new Date().toLocaleTimeString();
    const payload = extra !== undefined ? ` ${JSON.stringify(extra)}` : "";
    const entry = `[${ts}] ${line}${payload}`;
    console.info(`[mic-test] ${line}`, extra ?? "");
    setLog((prev) => [...prev, entry]);
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
    recRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      append("requesting microphone…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const track = stream.getAudioTracks()[0];
      append("mic granted", {
        label: track?.label,
        settings: track?.getSettings?.(),
      });

      const mime = pickMime();
      append("MediaRecorder mime", { mime: mime || "(default)" });
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          append("chunk", { bytes: e.data.size });
        }
      };
      rec.onerror = (e) => {
        append("MediaRecorder error", { event: String((e as Event).type) });
      };
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        const durationMs = Date.now() - startedAtRef.current;
        append("recording stopped", {
          chunks: chunksRef.current.length,
          bytes: blob.size,
          durationMs,
        });
        cleanup();
        setPhase("analyzing");
        const { rms, sampleRate, channels } = await analyze(blob);
        append("decoded", { rms, sampleRate, channels });
        setResult({
          bytes: blob.size,
          mime: blob.type,
          durationMs,
          rms,
          sampleRate,
          channels,
          url: URL.createObjectURL(blob),
        });
        setPhase("done");
      };

      startedAtRef.current = Date.now();
      setElapsed(0);
      setPhase("recording");
      rec.start();
      append("recording started");

      tickRef.current = window.setInterval(() => {
        setElapsed(Math.min(MAX_MS, Date.now() - startedAtRef.current));
      }, 100);

      stopTimerRef.current = window.setTimeout(() => {
        if (recRef.current?.state === "recording") {
          append("auto-stop at 10s cap");
          recRef.current.stop();
        }
      }, MAX_MS);
    } catch (err) {
      const message =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      append("mic denied or failed", { error: message });
      setError(message);
      setPhase("error");
      cleanup();
    }
  }, [append, cleanup]);

  const stop = useCallback(() => {
    if (recRef.current?.state === "recording") {
      append("user stop");
      recRef.current.stop();
    }
  }, [append]);

  const remaining = Math.max(0, Math.ceil((MAX_MS - elapsed) / 1000));
  const recording = phase === "recording";

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col gap-5 px-5 py-8 text-mist-300">
      <header>
        <h1 className="text-xl font-semibold text-mist-500">Mic Test</h1>
        <p className="mt-1 text-xs tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
          Records · Decodes · Plays back · No network
        </p>
      </header>

      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={phase === "analyzing"}
        className="rounded-xl border border-mist-300 px-5 py-4 text-sm tracking-[var(--tracking-chrome)] text-mist-500 uppercase transition hover:bg-white/[0.04] disabled:opacity-50"
      >
        {recording
          ? `Stop · ${remaining}s`
          : phase === "analyzing"
            ? "Decoding…"
            : phase === "done"
              ? "Record Again"
              : "Start Recording"}
      </button>

      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line-200 bg-ink-200 p-4">
          <h2 className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
            Result
          </h2>
          <dl className="grid grid-cols-2 gap-y-1 text-xs">
            <dt className="text-mist-100">bytes</dt>
            <dd className="text-mist-400">{result.bytes.toLocaleString()}</dd>
            <dt className="text-mist-100">mime</dt>
            <dd className="text-mist-400 break-all">{result.mime}</dd>
            <dt className="text-mist-100">duration</dt>
            <dd className="text-mist-400">{result.durationMs} ms</dd>
            <dt className="text-mist-100">rms</dt>
            <dd className="text-mist-400">
              {result.rms === null
                ? "—"
                : result.rms < 0.005
                  ? `${result.rms.toFixed(4)} (silence?)`
                  : result.rms.toFixed(4)}
            </dd>
            <dt className="text-mist-100">sample rate</dt>
            <dd className="text-mist-400">
              {result.sampleRate ? `${result.sampleRate} Hz` : "—"}
            </dd>
            <dt className="text-mist-100">channels</dt>
            <dd className="text-mist-400">{result.channels ?? "—"}</dd>
          </dl>
          <audio src={result.url} controls className="w-full" />
          <a
            href={result.url}
            download="mic-test.webm"
            className="text-xs tracking-[var(--tracking-chrome)] text-mist-200 uppercase underline-offset-4 hover:underline"
          >
            Download raw blob
          </a>
        </section>
      ) : null}

      <section className="flex flex-col gap-1 rounded-xl border border-line-100 bg-ink-100/70 p-3">
        <h2 className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
          Event log
        </h2>
        {log.length === 0 ? (
          <p className="text-xs text-mist-100">No events yet.</p>
        ) : (
          <pre className="max-h-72 overflow-y-auto text-[11px] leading-snug whitespace-pre-wrap text-mist-300">
            {log.join("\n")}
          </pre>
        )}
      </section>

      <p className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
        Tip: open the browser console for the same events with full objects.
      </p>
    </div>
  );
}
