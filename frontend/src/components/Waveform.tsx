import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";

interface Props {
  src: string;
  color: string;
}

export function Waveform({ src, color }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "rgba(255,255,255,0.18)",
      progressColor: color,
      cursorColor: "transparent",
      height: 56,
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      interact: true,
    });
    wsRef.current = ws;
    ws.load(src);
    ws.on("ready", () => setReady(true));
    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));
    return () => {
      ws.destroy();
      wsRef.current = null;
    };
  }, [src, color]);

  const toggle = () => {
    const ws = wsRef.current;
    if (!ws || !ready) return;
    void ws.playPause();
  };

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        disabled={!ready}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/[0.08] disabled:opacity-40"
      >
        {isPlaying ? (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <rect x="2" y="1" width="3.5" height="12" rx="0.6" />
            <rect x="8.5" y="1" width="3.5" height="12" rx="0.6" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
            <path d="M3 1.5v11l10-5.5z" />
          </svg>
        )}
      </button>
      <div ref={containerRef} className="min-w-0 flex-1" />
    </div>
  );
}
