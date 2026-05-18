type LogLevel = "debug" | "info" | "warn" | "error";

const ENABLED = process.env.LOG_LEVEL !== "silent";

function fmt(scope: string, level: LogLevel, msg: string, extra?: unknown) {
  const ts = new Date().toISOString().slice(11, 23);
  const prefix = `${ts} ${level.toUpperCase().padEnd(5)} [${scope}]`;
  if (extra !== undefined) {
    return [prefix, msg, extra] as const;
  }
  return [prefix, msg] as const;
}

function emit(level: LogLevel, scope: string, msg: string, extra?: unknown) {
  if (!ENABLED) return;
  const args = fmt(scope, level, msg, extra);
  if (level === "error") console.error(...args);
  else if (level === "warn") console.warn(...args);
  else console.log(...args);
}

export interface Logger {
  scope: string;
  child: (sub: string) => Logger;
  debug: (msg: string, extra?: unknown) => void;
  info: (msg: string, extra?: unknown) => void;
  warn: (msg: string, extra?: unknown) => void;
  error: (msg: string, extra?: unknown) => void;
  time: <T>(label: string, fn: () => Promise<T>) => Promise<T>;
}

export function createLogger(scope: string): Logger {
  return {
    scope,
    child: (sub) => createLogger(`${scope}:${sub}`),
    debug: (msg, extra) => emit("debug", scope, msg, extra),
    info: (msg, extra) => emit("info", scope, msg, extra),
    warn: (msg, extra) => emit("warn", scope, msg, extra),
    error: (msg, extra) => emit("error", scope, msg, extra),
    time: async (label, fn) => {
      const t0 = Date.now();
      emit("info", scope, `${label} → start`);
      try {
        const out = await fn();
        emit("info", scope, `${label} ← done`, { ms: Date.now() - t0 });
        return out;
      } catch (err) {
        emit("error", scope, `${label} ✖ failed`, {
          ms: Date.now() - t0,
          error: err instanceof Error ? err.message : err,
        });
        throw err;
      }
    },
  };
}
