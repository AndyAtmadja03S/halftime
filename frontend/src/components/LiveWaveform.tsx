import { useEffect, useRef } from "react";

interface Props {
  stream: MediaStream | null;
  bars?: number;
}

export function LiveWaveform({ stream, bars = 28 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const els: HTMLSpanElement[] = [];
    container.innerHTML = "";
    for (let i = 0; i < bars; i++) {
      const el = document.createElement("span");
      el.style.display = "inline-block";
      el.style.width = "3px";
      el.style.marginInline = "2px";
      el.style.borderRadius = "2px";
      el.style.background = "rgba(255,255,255,0.85)";
      el.style.height = "8%";
      el.style.transition = "height 80ms ease-out";
      container.appendChild(el);
      els.push(el);
    }

    const REST_HEIGHT = 8;

    if (!stream) {
      for (const el of els) el.style.height = `${REST_HEIGHT}%`;
      return () => {
        container.innerHTML = "";
      };
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new AudioCtx();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const SILENCE_THRESHOLD = 8;

    const draw = () => {
      analyser.getByteFrequencyData(data);
      let total = 0;
      for (let i = 0; i < data.length; i++) total += data[i];
      const avg = total / data.length;

      if (avg < SILENCE_THRESHOLD) {
        for (let i = 0; i < bars; i++) els[i].style.height = `${REST_HEIGHT}%`;
      } else {
        const step = Math.floor(data.length / bars) || 1;
        for (let i = 0; i < bars; i++) {
          let sum = 0;
          for (let j = 0; j < step; j++) sum += data[i * step + j] ?? 0;
          const v = sum / step / 255;
          const h = Math.max(REST_HEIGHT, Math.min(100, v * 130));
          els[i].style.height = `${h}%`;
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      try {
        src.disconnect();
      } catch {
        // ignore
      }
      void ctx.close();
      container.innerHTML = "";
    };
  }, [stream, bars]);

  return (
    <div
      ref={ref}
      aria-hidden
      className="flex h-14 w-full items-center justify-center"
    />
  );
}
