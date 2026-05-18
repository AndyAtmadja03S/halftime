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
import { feedRouter } from "./routes/feed.js";
import { meRouter } from "./routes/me.js";
import { postsRouter } from "./routes/posts.js";

const app = express();

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
  console.log(`API listening on http://localhost:${env.port}`);
});
