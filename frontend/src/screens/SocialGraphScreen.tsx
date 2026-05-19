import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface MockUser {
  id: string;
  handle: string;
  totalCaptures: number;
  isMe?: boolean;
  x3: number;
  y3: number;
  z3: number;
}

interface Connection {
  from: string;
  to: string;
  soundsInCommon: number;
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

const MOCK_USERS: MockUser[] = [
  { id: "me", handle: "YOU", totalCaptures: 142, isMe: true, x3: 0, y3: 0, z3: 0 },
  { id: "u1", handle: "VOID LISTENER", totalCaptures: 128, ...spherePoint(0, 7, NODE_RADIUS) },
  { id: "u2", handle: "QUIET WANDERER", totalCaptures: 87, ...spherePoint(1, 7, NODE_RADIUS) },
  { id: "u3", handle: "DRIFT ECHO", totalCaptures: 156, ...spherePoint(2, 7, NODE_RADIUS) },
  { id: "u4", handle: "SOFT SIGNAL", totalCaptures: 64, ...spherePoint(3, 7, NODE_RADIUS) },
  { id: "u5", handle: "RAIN STATION", totalCaptures: 203, ...spherePoint(4, 7, NODE_RADIUS) },
  { id: "u6", handle: "NEON HARBOR", totalCaptures: 92, ...spherePoint(5, 7, NODE_RADIUS) },
  { id: "u7", handle: "AMBER FIELD", totalCaptures: 111, ...spherePoint(6, 7, NODE_RADIUS) },
];

const MOCK_CONNECTIONS: Connection[] = [
  { from: "me", to: "u1", soundsInCommon: 24 },
  { from: "me", to: "u2", soundsInCommon: 18 },
  { from: "me", to: "u3", soundsInCommon: 31 },
  { from: "me", to: "u5", soundsInCommon: 12 },
  { from: "u1", to: "u2", soundsInCommon: 19 },
  { from: "u1", to: "u3", soundsInCommon: 15 },
  { from: "u2", to: "u4", soundsInCommon: 9 },
  { from: "u3", to: "u5", soundsInCommon: 22 },
  { from: "u3", to: "u7", soundsInCommon: 14 },
  { from: "u5", to: "u6", soundsInCommon: 17 },
];

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
  const usersRef = useRef<MockUser[]>(MOCK_USERS);

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
    for (const conn of MOCK_CONNECTIONS) {
      const from = posById.get(conn.from);
      const to = posById.get(conn.to);
      if (!from || !to) continue;
      const involvesMe = conn.from === "me" || conn.to === "me";
      const midDepth = (from.depth + to.depth) / 2;
      const depthFade = Math.max(0.25, Math.min(1, 1.15 + midDepth / (NODE_RADIUS * 2.2)));
      if (involvesMe) {
        ctx.strokeStyle = `rgba(52, 211, 153, ${(0.35 + 0.4) * depthFade})`;
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = `rgba(147, 197, 253, ${(0.22 + 0.38) * depthFade * 0.6})`;
        ctx.lineWidth = 1.2;
      }
      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.stroke();
    }

    // Nodes
    for (const { user: u, sx, sy, depth, scale: depthScale } of projected) {
      const isSelected = selected === u.id;
      const isHovered = hovered === u.id;
      const isMe = u.isMe === true;
      const baseR = isMe ? 26 : isSelected ? 28 : isHovered ? 24 : 20;
      const radius = baseR * Math.max(0.55, depthScale);
      const depthFade = Math.max(0.4, Math.min(1, 1.1 + depth / (NODE_RADIUS * 2)));

      let fillColor: string;
      let borderColor: string;
      let borderWidth: number;

      if (isMe) {
        fillColor = `rgba(16, 185, 129, 1)`;
        borderColor = `rgba(52, 211, 153, 1)`;
        borderWidth = isSelected ? 3 : 2.5;
      } else if (isSelected) {
        fillColor = `rgba(59, 130, 246, 1)`;
        borderColor = "rgba(147, 197, 253, 1)";
        borderWidth = 2.5;
      } else if (isHovered) {
        fillColor = `rgba(99, 179, 237, 0.9)`;
        borderColor = `rgba(147, 197, 253, 1)`;
        borderWidth = 2;
      } else {
        fillColor = `rgba(99, 116, 160, 0.85)`;
        borderColor = `rgba(147, 197, 253, 0.8)`;
        borderWidth = 1.5;
      }

      // Glow
// Glow
      ctx.fillStyle = isMe
        ? `rgba(16, 185, 129, 0.25)`
        : `rgba(99, 116, 160, 0.15)`;
      ctx.beginPath();
      ctx.arc(sx, sy, radius + 12 * depthScale, 0, Math.PI * 2);
      ctx.fill();

      // Fill
      ctx.fillStyle = isMe
        ? `#10b981`
        : isSelected
          ? `#3b82f6`
          : isHovered
            ? `#60a5fa`
            : `#4a5568`;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = isMe
        ? `#34d399`
        : isSelected
          ? `#93c5fd`
          : isHovered
            ? `#bfdbfe`
            : `#6b7280`;
      ctx.lineWidth = isMe ? 2.5 : isSelected ? 2.5 : isHovered ? 2 : 1.5;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // "YOU" label
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

  const selectedUserData = MOCK_USERS.find((u) => u.id === selectedUser);
  const connections = MOCK_CONNECTIONS.filter(
    (c) => c.from === selectedUser || c.to === selectedUser,
  );
  const friendCount = MOCK_CONNECTIONS.filter(
    (c) => c.from === "me" || c.to === "me"
  ).length;

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
          <p className="text-[11px] text-mist-100">{friendCount} friends connected</p>
        </motion.div>

        {/* Legend */}
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
            <div className="h-2.5 w-2.5 rounded-full bg-blue-400" />
            <span className="text-mist-200">Friend</span>
          </div>
        </motion.div>

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
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {selectedUserData.isMe && (
                    <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  )}
                  <h3 className="text-lg font-semibold text-mist-500">
                    {selectedUserData.isMe ? "You" : selectedUserData.handle}
                  </h3>
                </div>
                <p className="text-xs text-mist-200">
                  {selectedUserData.totalCaptures} sounds captured
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

            {connections.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wider text-mist-200">
                  {selectedUserData.isMe ? "Your friends" : "Mutual friends"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {connections.map((conn) => {
                    const connectedId = conn.from === selectedUser ? conn.to : conn.from;
                    const connectedUser = MOCK_USERS.find((u) => u.id === connectedId);
                    if (!connectedUser) return null;
                    return (
                      <motion.button
                        key={connectedId}
                        type="button"
                        onClick={() => setSelectedUser(connectedId)}
                        initial={{ scale: 0.96, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 transition hover:bg-white/[0.08]"
                      >
                        <div className={`h-2 w-2 rounded-full ${connectedUser.isMe ? "bg-emerald-400" : "bg-blue-400"}`} />
                        <span className="text-xs text-mist-300">
                          {connectedUser.isMe ? "You" : connectedUser.handle}
                        </span>
                        <span className="font-mono text-[10px] text-mist-100">
                          {conn.soundsInCommon} sounds
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="py-2 text-center">
            <p className="text-xs uppercase tracking-wider text-mist-200">
              Tap a friend to see your connection
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}