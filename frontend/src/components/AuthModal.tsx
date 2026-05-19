import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { ApiError, login, register } from "../lib/api";
import { setSession, type AuthUser } from "../lib/auth";

type Mode = "register" | "login";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
  title?: string;
  subtitle?: string;
}

export function AuthModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Create an account to post",
  subtitle = "Pick a username and password. You'll need this to share captures.",
}: Props) {
  const [mode, setMode] = useState<Mode>("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setError(null);
    setPassword("");
    setConfirm("");
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim().toLowerCase();
    if (mode === "register" && password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === "register"
          ? await register(u, password)
          : await login(u, password);
      setSession(result.token, result.user);
      onSuccess(result.user);
      setUsername("");
      resetForm();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "username_taken") {
          setError("That username is taken.");
        } else if (err.code === "invalid_login") {
          setError("Invalid username or password.");
        } else if (err.code === "invalid_credentials") {
          setError(
            "Username must be 3–24 chars (lowercase letters, numbers, underscore). Password at least 8 chars.",
          );
        } else {
          setError("Something went wrong. Try again.");
        }
      } else {
        setError("Something went wrong. Try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-4 top-[12%] z-50 mx-auto flex max-w-sm flex-col gap-5 rounded-3xl border border-white/10 bg-gradient-to-b from-ink-100 to-ink-0 p-6 shadow-2xl"
          >
            <div>
              <h2 className="text-xl font-semibold text-mist-500">{title}</h2>
              <p className="mt-1 text-sm text-mist-200">{subtitle}</p>
            </div>

            <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                  Username
                </span>
                <input
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="rounded-lg border border-line-200 bg-ink-200 px-3 py-2.5 text-sm text-mist-500 outline-none focus:border-mist-500"
                  placeholder="your_name"
                  required
                  minLength={3}
                  maxLength={24}
                  pattern="[a-z0-9_]+"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={
                    mode === "register" ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-lg border border-line-200 bg-ink-200 px-3 py-2.5 text-sm text-mist-500 outline-none focus:border-mist-500"
                  required
                  minLength={8}
                />
              </label>

              {mode === "register" ? (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] tracking-[var(--tracking-chrome)] text-mist-100 uppercase">
                    Confirm password
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="rounded-lg border border-line-200 bg-ink-200 px-3 py-2.5 text-sm text-mist-500 outline-none focus:border-mist-500"
                    required
                    minLength={8}
                  />
                </label>
              ) : null}

              {error ? (
                <p className="text-sm text-red-400/90">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={busy}
                style={{ color: "var(--color-ink-300)" }}
                className={clsx(
                  "mt-1 rounded-lg border border-mist-500 bg-mist-500 px-5 py-3 text-sm font-medium tracking-[var(--tracking-chrome)] uppercase transition",
                  busy && "opacity-60",
                )}
              >
                {busy
                  ? "One moment…"
                  : mode === "register"
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <p className="text-center text-xs text-mist-200">
              {mode === "register" ? (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="text-mist-500 underline-offset-2 hover:underline"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  New here?{" "}
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className="text-mist-500 underline-offset-2 hover:underline"
                  >
                    Create account
                  </button>
                </>
              )}
            </p>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
