import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef } from "react";
import type { Post } from "../lib/api";

interface Props {
  posts: Post[];
  fallbackCenter?: [number, number];
}

const DEFAULT_CENTER: [number, number] = [0, 20];

const DARK_STYLE = {
  version: 8 as const,
  sources: {
    carto: {
      type: "raster" as const,
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OSM</a>, © <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  layers: [
    {
      id: "carto-dark",
      type: "raster" as const,
      source: "carto",
      minzoom: 0,
      maxzoom: 22,
    },
  ],
};

function buildMarker(post: Post, isMine: boolean): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "halftime-marker";
  wrap.style.cursor = "pointer";
  wrap.style.transform = "translateY(-6px)";
  wrap.innerHTML = `
    <div style="
      position: relative;
      display: grid;
      place-items: center;
      width: ${isMine ? 52 : 40}px;
      height: ${isMine ? 52 : 40}px;
      border-radius: 999px;
      background: rgba(20,20,26,0.95);
      border: 1px solid ${isMine ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.18)"};
      box-shadow: ${isMine ? "0 12px 28px -8px rgba(0,0,0,0.7)" : "0 6px 18px -8px rgba(0,0,0,0.6)"};
    ">
      <span style="font-size: ${isMine ? 24 : 20}px; line-height: 1;">${post.emoji}</span>
      ${
        isMine
          ? `<span style="
            position: absolute;
            bottom: -6px;
            left: 50%;
            width: 2px;
            height: 14px;
            transform: translateX(-50%);
            background: rgba(255,255,255,0.6);
          "></span>`
          : ""
      }
    </div>
  `;
  return wrap;
}

export function MapView({ posts, fallbackCenter = DEFAULT_CENTER }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MlMap | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const located = useMemo(
    () =>
      posts.filter(
        (p): p is Post & { latitude: number; longitude: number } =>
          p.latitude !== null && p.longitude !== null,
      ),
    [posts],
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const myPost = located.find((p) => p.is_mine);
    const initial: [number, number] = myPost
      ? [myPost.longitude, myPost.latitude]
      : located[0]
        ? [located[0].longitude, located[0].latitude]
        : fallbackCenter;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: initial,
      zoom: myPost || located.length > 0 ? 12 : 2,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => map.resize());
    mapRef.current = map;

    return () => {
      for (const m of markersRef.current) m.remove();
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [fallbackCenter, located]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const m of markersRef.current) m.remove();
    markersRef.current = [];
    for (const post of located) {
      const el = buildMarker(post, post.is_mine);
      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([post.longitude, post.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, [located]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-0">
      <div ref={containerRef} className="h-full w-full" />
      {located.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="rounded-full border border-line-200 bg-ink-100/70 px-4 py-2 text-[10px] tracking-[var(--tracking-chrome)] text-mist-200 uppercase backdrop-blur">
            No located sounds yet
          </p>
        </div>
      ) : null}
    </div>
  );
}
