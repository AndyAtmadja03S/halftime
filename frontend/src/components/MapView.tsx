import maplibregl, { type Map as MlMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, sendFriendRequestByUsername, type Post } from "../lib/api";
import { colorFor } from "../lib/categoryColor";
import { relativeTime } from "../lib/relativeTime";
import { Waveform } from "./Waveform";

type FriendBtnState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; status: "pending" | "accepted" }
  | { kind: "already" }
  | { kind: "pending" }
  | { kind: "error"; message: string };

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
      maxzoom: 14,
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
      paint: {
        "raster-opacity": 0.92,
        "raster-brightness-min": 0.18,
        "raster-brightness-max": 1.0,
        "raster-saturation": 0.25,
        "raster-contrast": 0.18,
        "raster-hue-rotate": 215,
      },
    },
  ],
};

const FALLBACK_EMOJI: Record<string, string> = {
  rain: "🌧️",
  cafe: "☕",
  commute: "🚇",
  city_night: "🌃",
  nature: "🌿",
  ocean: "🌊",
  quiet: "💤",
  crowd: "🔥",
  other: "🌫️",
};
const EMOJI_RE = /\p{Extended_Pictographic}/u;
function safeEmoji(post: Post): string {
  if (post.emoji && EMOJI_RE.test(post.emoji)) return post.emoji;
  return FALLBACK_EMOJI[post.category] ?? "🌫️";
}

// colorFor() returns "var(--color-accent-X)". For inline gradient/box-shadow
// concatenation we need the resolved hex so we can append alpha (e.g. "#abc55").
function resolveAccent(category: string): string {
  const v = colorFor(category);
  const m = v.match(/--[\w-]+/);
  if (!m) return "#7a8bbd";
  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(m[0])
    .trim();
  return resolved || "#7a8bbd";
}

function buildMarker(post: Post, isMine: boolean): HTMLElement {
  const accent = resolveAccent(post.category);
  const size = isMine ? 52 : 40;

  const wrap = document.createElement("div");
  wrap.className = "halftime-marker";
  wrap.style.cursor = "pointer";
  wrap.style.transform = "translateY(-6px)";
  wrap.innerHTML = `
    <div style="
      position: relative;
      display: grid;
      place-items: center;
      width: ${size}px;
      height: ${size}px;
      border-radius: 999px;
      background: rgba(20,20,26,0.95);
      border: 1px solid ${isMine ? "rgba(255,255,255,0.85)" : `${accent}66`};
      box-shadow:
        0 0 0 1px ${accent}22,
        0 6px 18px -4px rgba(0,0,0,0.55)${isMine ? `, 0 0 24px ${accent}44` : ""};
    ">
      <span style="font-size: ${isMine ? 24 : 20}px; line-height: 1;">${safeEmoji(post)}</span>
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
  // Map from marker element → post so vanilla DOM handlers can reference the post
  const markerPostsRef = useRef<Map<HTMLElement, Post>>(new Map());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [friendBtn, setFriendBtn] = useState<FriendBtnState>({ kind: "idle" });

  // Stable ref so marker click handlers always call the latest setter
  const handleClickRef = useRef<(post: Post) => void>(() => {});
  handleClickRef.current = (post: Post) => {
    const isDeselect = selectedPost?.id === post.id;
    setSelectedPost(isDeselect ? null : post);
    setFriendBtn({ kind: "idle" });

    // On selection, pan to put the marker at the exact center of the viewport.
    if (
      !isDeselect &&
      post.latitude !== null &&
      post.longitude !== null &&
      mapRef.current
    ) {
      mapRef.current.easeTo({
        center: [post.longitude, post.latitude],
        duration: 600,
      });
    }
  };

  async function handleAddFriend(username: string) {
    setFriendBtn({ kind: "sending" });
    try {
      const r = await sendFriendRequestByUsername(username);
      setFriendBtn({ kind: "sent", status: r.status });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "already_friends") {
          setFriendBtn({ kind: "already" });
          return;
        }
        if (err.code === "request_already_sent") {
          setFriendBtn({ kind: "pending" });
          return;
        }
        setFriendBtn({ kind: "error", message: err.code });
        return;
      }
      setFriendBtn({ kind: "error", message: "request_failed" });
    }
  }

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

    // If we have multiple posts spread across locations, fit the map to show all of them.
    // Otherwise centre on the user's post (or first post, or world view).
    let boundsOption: maplibregl.LngLatBoundsLike | undefined;
    if (located.length > 1) {
      const b = new maplibregl.LngLatBounds();
      for (const p of located) b.extend([p.longitude, p.latitude]);
      boundsOption = b;
    }

    const myPost = located.find((p) => p.is_mine);
    const initial: [number, number] = myPost
      ? [myPost.longitude, myPost.latitude]
      : located[0]
        ? [located[0].longitude, located[0].latitude]
        : fallbackCenter;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      ...(boundsOption
        ? { bounds: boundsOption, fitBoundsOptions: { padding: 80, maxZoom: 14 } }
        : { center: initial, zoom: located.length > 0 ? 13 : 2 }),
      attributionControl: false,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showZoom: true, showCompass: false }),
      "top-right",
    );
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
    markerPostsRef.current.clear();

    // Group posts that share the same approximate location (~11m grid)
    const groups = new Map<string, typeof located>();
    for (const post of located) {
      const key = `${post.latitude.toFixed(4)},${post.longitude.toFixed(4)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(post);
    }

    for (const group of groups.values()) {
      const count = group.length;
      group.forEach((post, i) => {
        // Spread overlapping markers in a circle with 28px radius
        let offset: [number, number] = [0, 0];
        if (count > 1) {
          const angle = (2 * Math.PI * i) / count - Math.PI / 2;
          const radius = count === 2 ? 22 : 28;
          offset = [Math.cos(angle) * radius, Math.sin(angle) * radius];
        }
        const el = buildMarker(post, post.is_mine);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          handleClickRef.current(post);
        });
        markerPostsRef.current.set(el, post);
        const marker = new maplibregl.Marker({ element: el, anchor: "center", offset })
          .setLngLat([post.longitude, post.latitude])
          .addTo(map);
        markersRef.current.push(marker);
      });
    }
  }, [located]);

  // Highlight the active marker
  useEffect(() => {
    for (const [el, post] of markerPostsRef.current) {
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) continue;
      const accent = resolveAccent(post.category);
      const active = selectedPost?.id === post.id;
      inner.style.transition = "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease";
      inner.style.transform = active ? "scale(1.25)" : "";
      inner.style.boxShadow = active
        ? `0 0 0 3px rgba(255,255,255,0.35), 0 14px 32px -8px rgba(0,0,0,0.8), 0 0 28px ${accent}66`
        : post.is_mine
          ? `0 0 0 1px ${accent}22, 0 6px 18px -4px rgba(0,0,0,0.55), 0 0 24px ${accent}44`
          : `0 0 0 1px ${accent}22, 0 6px 18px -4px rgba(0,0,0,0.55)`;
      inner.style.borderColor = active
        ? "rgba(255,255,255,0.9)"
        : post.is_mine
          ? "rgba(255,255,255,0.85)"
          : `${accent}66`;
    }
  }, [selectedPost]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink-0">
      <div ref={containerRef} className="h-full w-full" />

      {/* Atmospheric radial vignette so the map fades toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(8,10,22,0.55) 100%)",
        }}
      />

      {/* Tap-to-dismiss scrim */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-50 bg-black/40"
            onClick={() => setSelectedPost(null)}
          />
        )}
      </AnimatePresence>

      {/* Post detail card */}
      <AnimatePresence>
        {selectedPost && (
          <motion.div
            key={selectedPost.id}
            initial={{ y: 48, opacity: 0, filter: "blur(6px)" }}
            animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
            exit={{ y: 48, opacity: 0, filter: "blur(6px)" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="absolute bottom-0 left-0 right-0 z-50 px-3 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag pill */}
            <div className="mb-2 flex justify-center">
              <div className="h-1 w-10 rounded-full bg-white/20" />
            </div>

            <div
              className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d0d12]/95 p-5 backdrop-blur-xl"
              style={{ boxShadow: "0 -12px 48px -8px rgba(0,0,0,0.7)" }}
            >
              {/* Accent top line */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background: `linear-gradient(to right, transparent, ${colorFor(selectedPost.category)}66, transparent)`,
                }}
              />

              {/* Close button */}
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-white/40 transition hover:bg-white/[0.12] hover:text-white/80"
                aria-label="Close"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>

              {/* Header */}
              <div className="flex items-start gap-4 pr-8">
                <div
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/[0.06]"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, ${colorFor(selectedPost.category)}30, transparent 70%)`,
                  }}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {selectedPost.emoji}
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-display text-base italic leading-snug text-mist-400">
                    {selectedPost.description}
                  </p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-mist-100">
                    {selectedPost.category.replace(/_/g, " ")}
                    {" · "}
                    {relativeTime(selectedPost.created_at)}
                    {selectedPost.is_mine
                      ? " · yours"
                      : selectedPost.handle
                        ? ` · @${selectedPost.handle}`
                        : ""}
                  </p>
                </div>
              </div>

              {/* Waveform */}
              <div className="mt-4">
                {selectedPost.audio_url ? (
                  <Waveform src={selectedPost.audio_url} color={colorFor(selectedPost.category)} />
                ) : (
                  <p className="text-xs text-mist-100">Audio unavailable.</p>
                )}
              </div>

              {selectedPost.handle && !selectedPost.is_mine ? (
                <div className="mt-4">
                  <FriendActionButton
                    state={friendBtn}
                    onClick={() => handleAddFriend(selectedPost.handle!)}
                  />
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {located.length === 0 && !selectedPost ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="rounded-full border border-line-200 bg-ink-100/70 px-4 py-2 text-[10px] tracking-[var(--tracking-chrome)] text-mist-200 uppercase backdrop-blur">
            No located sounds yet
          </p>
        </div>
      ) : null}
    </div>
  );
}

function FriendActionButton({
  state,
  onClick,
}: {
  state: FriendBtnState;
  onClick: () => void;
}) {
  const disabled =
    state.kind === "sending" ||
    state.kind === "sent" ||
    state.kind === "already" ||
    state.kind === "pending";

  let label = "Add as friend";
  if (state.kind === "sending") label = "Sending…";
  else if (state.kind === "sent")
    label = state.status === "accepted" ? "Friends ✓" : "Request sent ✓";
  else if (state.kind === "already") label = "Already friends";
  else if (state.kind === "pending") label = "Request pending";
  else if (state.kind === "error") label = "Couldn’t send — tap to retry";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "w-full rounded-full border px-4 py-2 text-[12px] uppercase tracking-[0.14em] transition " +
        (disabled
          ? "border-white/[0.08] bg-white/[0.04] text-mist-200"
          : "border-white/[0.18] bg-white/[0.08] text-mist-400 hover:bg-white/[0.14] active:bg-white/[0.18]")
      }
    >
      {label}
    </button>
  );
}
