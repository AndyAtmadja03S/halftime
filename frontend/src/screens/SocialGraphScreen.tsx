import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { fetchFriends, type FriendUser } from "../lib/api";
import { getStoredUser } from "../lib/auth";

interface GraphNode {
  id: string;
  handle: string;
  username: string | null;
  isMe?: boolean;
  x3: number;
  y3: number;
  z3: number;
}

interface Connection {
  from: string;
  to: string;
}

function spherePoint(index: number, total: number, radius: number) {
  const y = 1 - (index / Math.max(1, total - 1)) * 2;
  const rAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const theta = golden * index;
  return {
    x3: Math.cos(theta) * rAtY * radius,
    y3: y * radius,
    z3: Math.sin(theta) * rAtY * radius,
  };
}

const NODE_RADIUS = 140;

const AUTO_ROTATE_Y = 0.045;
const FOCAL = 420;
const BASE_SCALE = 1;

function rotateY(x: number, y: number, z: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c + z * s, y, z: -x * s + z * c };
}

function rotateX(x: number, y: number, z: number, angle: number) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x, y: y * c - z * s, z: y * s + z * c };
}

function project(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  rotX: number,
  rotY: number,
  zoom: number,
): { sx: number; sy: number; depth: number; scale: number } {
  let p = rotateY(x, y, z, rotY);
  p = rotateX(p.x, p.y, p.z, rotX);
  const depth = p.z;
  const perspective = FOCAL / (FOCAL + depth);
  const scale = perspective * zoom * BASE_SCALE;
  return { sx: cx + p.x * scale, sy: cy + p.y * scale, depth, scale };
}

export function SocialGraphScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchFriends()
      .then((res) => {
        if (alive) setFriends(res.friends);
      })
      .catch(() => {
        if (alive) setFriends([]);
      })
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const storedUser = getStoredUser();
  const meLabel = storedUser?.displayName ?? storedUser?.username ?? "YOU";

  const nodes = useMemo<GraphNode[]>(() => {
    const list: GraphNode[] = [
      {
        id: "me",
        handle: meLabel,
        username: storedUser?.username ?? null,
        isMe: true,
        x3: 0,
        y3: 0,
        z3: 0,
      },
    ];
    friends.forEach((f, i) => {
      list.push({
        id: f.id,
        handle: f.displayName,
        username: f.username,
        ...spherePoint(i, Math.max(2, friends.length), NODE_RADIUS),
      });
    });
    return list;
  }, [friends, meLabel, storedUser?.username]);

  const connections = useMemo<Connection[]>(
    () => friends.map((f) => ({ from: "me", to: f.id })),
    [friends],
  );

  const directFriendIds = useMemo(
    () => new Set(friends.map((f) => f.id)),
    [friends],
  );

  const usersRef = useRef<GraphNode[]>(nodes);
  const connectionsRef = useRef<Connection[]>(connections);
  const directFriendIdsRef = useRef<Set<string>>(directFriendIds);
  useEffect(() => { usersRef.current = nodes; }, [nodes]);
  useEffect(() => { connectionsRef.current = connections; }, [connections]);
  useEffect(() => { directFriendIdsRef.current = directFriendIds; }, [directFriendIds]);

  const rotationRef = useRef({ x: -0.35, y: 0 });
  const zoomRef = useRef(1);
  const dragRef = useRef<{
    active: boolean;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    dragged: boolean;
  }>({ active: false, lastX: 0, lastY: 0, startX: 0, startY: 0, dragged: false });

  const animationRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [hoveredUser, setHoveredUser] = useState<string | null>(null);
  const selectedUserRef = useRef<string | null>(null);
  const hoveredUserRef = useRef<string | null>(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);
  useEffect(() => { hoveredUserRef.current = hoveredUser; }, [hoveredUser]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const cx = W / 2;
    const cy = H / 2;
    const users = usersRef.current;
    const conns = connectionsRef.current;
    const friendSet = directFriendIdsRef.current;
    const selected = selectedUserRef.current;
    const hovered = hoveredUserRef.current;
    const { x: rotX, y: rotY } = rotationRef.current;
    const zoom = zoomRef.current;

    ctx.fillStyle = "#07070a";
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    const gridR = NODE_RADIUS * 1.35;
    for (let i = -3; i <= 3; i++) {
      const t = (i / 3) * gridR;
      const a = project(-gridR, gridR * 0.35, t, cx, cy, rotX, rotY, zoom);
      const b = project(gridR, gridR * 0.35, t, cx, cy, rotX, rotY, zoom);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      const c = project(t, gridR * 0.35, -gridR, cx, cy, rotX, rotY, zoom);
      const d = project(t, gridR * 0.35, gridR, cx, cy, rotX, rotY, zoom);
      ctx.beginPath(); ctx.moveTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy); ctx.stroke();
    }

    const projected = users.map((u) => {
      const p = project(u.x3, u.y3, u.z3, cx, cy, rotX, rotY, zoom);
      return { user: u, ...p };
    });
    projected.sort((a, b) => a.depth - b.depth);

    const posById = new Map(projected.map((p) => [p.user.id, p]));

    // Edges
    for (const conn of conns) {
      const from = posById.get(conn.from);
      const to = posById.get(conn.to);
      if (!from || !to) continue;
      ctx.strokeStyle = `rgba(52, 211, 153, 0.7)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.stroke();
    }

    // Nodes
    for (const { user: u, sx, sy, scale: depthScale } of projected) {
      const isSelected = selected === u.id;
      const isHovered = hovered === u.id;
      const isMe = u.isMe === true;
      const isDirectFriend = friendSet.has(u.id);

      const baseR = isMe ? 26 : isSelected ? 28 : isHovered ? 24 : 20;
      const radius = baseR * Math.max(0.55, depthScale);

      ctx.fillStyle = isMe
        ? `rgba(16, 185, 129, 0.25)`
        : isDirectFriend
          ? `rgba(147, 197, 253, 0.15)`
          : `rgba(99, 116, 160, 0.1)`;
      ctx.beginPath();
      ctx.arc(sx, sy, radius + 12 * depthScale, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isMe
        ? `#10b981`
        : isDirectFriend
          ? isSelected ? `#93c5fd` : isHovered ? `#bfdbfe` : `#60a5fa`
          : `#4a5568`;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = isMe
        ? `#34d399`
        : isDirectFriend
          ? `#bfdbfe`
          : `#6b7280`;
      ctx.lineWidth = isMe ? 2.5 : isSelected ? 2.5 : isHovered ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      if (isMe) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `bold ${Math.round(8 * Math.max(0.7, depthScale))}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("YOU", sx, sy);
      }
    }
  }, []);

  useEffect(() => {
    const tick = (ts: number) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      if (!dragRef.current.active) rotationRef.current.y += AUTO_ROTATE_Y * dt;
      drawFrame();
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      lastTsRef.current = null;
    };
  }, [drawFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  const getProjectedScreenCoords = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return [];
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const cx = W / 2;
    const cy = H / 2;
    const { x: rotX, y: rotY } = rotationRef.current;
    const zoom = zoomRef.current;
    return usersRef.current.map((u) => {
      const p = project(u.x3, u.y3, u.z3, cx, cy, rotX, rotY, zoom);
      return { id: u.id, sx: p.sx, sy: p.sy, scale: p.scale };
    });
  }, []);

  const pickNodeAt = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const projected = getProjectedScreenCoords();
    let best: string | null = null;
    let bestD = 36;
    for (const p of projected) {
      const r = 22 * Math.max(0.55, p.scale);
      const d = Math.hypot(p.sx - x, p.sy - y);
      if (d < r && d < bestD) { bestD = d; best = p.id; }
    }
    return best;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active) {
      const dx = e.clientX - dragRef.current.lastX;
      const dy = e.clientY - dragRef.current.lastY;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      if (!dragRef.current.dragged && Math.hypot(e.clientX - dragRef.current.startX, e.clientY - dragRef.current.startY) > 8) {
        dragRef.current.dragged = true;
      }
      rotationRef.current.y += dx * 0.006;
      rotationRef.current.x += dy * 0.006;
      rotationRef.current.x = Math.max(-1.1, Math.min(1.1, rotationRef.current.x));
      return;
    }
    setHoveredUser(pickNodeAt(e.clientX, e.clientY));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY, dragged: false };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.active && !dragRef.current.dragged) {
      const id = pickNodeAt(e.clientX, e.clientY);
      setSelectedUser(id);
    }
    dragRef.current.active = false;
    dragRef.current.dragged = false;
    try { (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const next = zoomRef.current * (1 - e.deltaY * 0.001);
    zoomRef.current = Math.max(0.55, Math.min(2.2, next));
  };

  const selectedUserData = nodes.find((u) => u.id === selectedUser);
  const friendCount = friends.length;
  const showEmptyState = loaded && friendCount === 0;

  return (
    <div className="relative flex h-full w-full flex-col bg-ink-0">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <canvas
          ref={canvasRef}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="h-full w-full cursor-grab touch-none active:cursor-grabbing"
        />

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute top-4 left-4 flex flex-col gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs backdrop-blur"
        >
          <p className="text-mist-200 uppercase tracking-wider">Your Network</p>
          <p className="text-[11px] text-mist-100">
            {friendCount} {friendCount === 1 ? "friend" : "friends"} connected
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="pointer-events-none absolute top-4 right-4 flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs backdrop-blur"
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <span className="text-mist-200">You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-blue-300" />
            <span className="text-mist-200">Friend</span>
          </div>
        </motion.div>

        {showEmptyState ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center"
          >
            <div className="max-w-[260px] rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur">
              <p className="text-sm text-mist-300">No friends yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-mist-100">
                Share your code from your profile to start building your
                network.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="pointer-events-none absolute bottom-4 left-4 max-w-[220px] rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs backdrop-blur"
          >
            <p className="text-mist-200 uppercase tracking-wider">Explore</p>
            <p className="mt-1 text-[11px] leading-relaxed text-mist-100">
              Drag to orbit · scroll to zoom · tap a friend for details
            </p>
          </motion.div>
        )}
      </div>

      <motion.div
        layout
        className="border-t border-white/10 bg-gradient-to-t from-ink-100 to-ink-0 px-4 py-4"
      >
        {selectedUserData ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${
                      selectedUserData.isMe
                        ? "bg-emerald-400"
                        : "bg-blue-300"
                    }`}
                  />
                  <h3 className="truncate text-lg font-semibold text-mist-500">
                    {selectedUserData.isMe ? "You" : selectedUserData.handle}
                  </h3>
                </div>
                {selectedUserData.username && (
                  <p className="mt-1 truncate text-[11px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                    @{selectedUserData.username}
                  </p>
                )}
                <p className="mt-1 text-xs text-mist-200">
                  {selectedUserData.isMe ? "Your profile" : "Direct friend"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-mist-300 transition hover:text-mist-500"
              >
                ✕
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="py-2 text-center">
            <p className="text-xs uppercase tracking-wider text-mist-200">
              {showEmptyState
                ? "Add a friend from your profile to start"
                : "Tap a node to explore your network"}
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
