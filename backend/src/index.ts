import "dotenv/config";
import cors from "cors";
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { MulterError } from "multer";
import { env } from "./lib/env.js";
import { createLogger } from "./lib/log.js";
import { feedRouter } from "./routes/feed.js";
import { meRouter } from "./routes/me.js";
import { postsRouter } from "./routes/posts.js";

const log = createLogger("server");
const app = express();

app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/")) {
    log.debug(`${req.method} ${req.path}`, {
      deviceId: req.header("x-device-id") ?? null,
      hour: req.header("x-device-hour") ?? null,
    });
  }
  next();
});

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true });
});

app.use("/api/posts", postsRouter);
app.use("/api/feed", feedRouter);
app.use("/api/me", meRouter);

app.use((_req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({ error: "not_found" });
});

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("[api error]", err);
  if (err instanceof MulterError) {
    res.status(400).json({ error: "upload_error", code: err.code });
    return;
  }
  res.status(500).json({ error: "internal_error" });
};
app.use(errorHandler);

app.listen(env.port, () => {
  log.info(`API listening on http://localhost:${env.port}`, {
    supabaseUrl: env.supabaseUrl.replace(/^https?:\/\//, "").slice(0, 32),
    bucket: env.supabaseBucket,
    openaiKey: env.openaiApiKey ? `${env.openaiApiKey.slice(0, 7)}…` : null,
  });
});
