import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { resolve } from "path";
import rooms from "./routes/rooms";
import { registerRoomHandlers, stopRoomTimers } from "./socket/roomHandlers";
import {
  cleanup,
  Fault,
  rate,
  recoverPresence,
  reclaimExpiredParticipants,
  RECONNECT_GRACE_MS,
} from "./runtime";
export const app = express();
const origins = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());
app.disable("x-powered-by");
// Only enable this for the actual trusted reverse proxy, never arbitrary forwarded headers.
if (process.env.TRUST_PROXY) app.set("trust proxy", process.env.TRUST_PROXY);
const maxInFlight = Math.max(
  1,
  Number(process.env.MAX_IN_FLIGHT_REQUESTS) || 32,
);
let inFlight = 0;
app.use((_req, res, next) => {
  if (inFlight >= maxInFlight) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({
      status: "error",
      message: "Server is busy; please retry shortly",
    });
    return;
  }
  inFlight++;
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      inFlight--;
    }
  };
  res.once("finish", release);
  res.once("close", release);
  next();
});
app.use(cors({ origin: origins, methods: ["GET", "POST"] }));
app.use((req, _res, next) => {
  try {
    rate("http:" + req.ip, 1200);
    next();
  } catch (e) {
    next(e);
  }
});
app.use(express.json({ limit: "8mb" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/rooms", rooms);
app.use("/api/rooms", rooms);
// Optional single-service deployment: REST, sockets, and the built React app share an origin.
if (process.env.CLIENT_DIST) {
  const root = resolve(process.env.CLIENT_DIST);
  app.use(
    express.static(root, {
      index: false,
      setHeaders: (res, file) => {
        res.setHeader(
          "Cache-Control",
          /[/\\]assets[/\\]/.test(file)
            ? "public, max-age=31536000, immutable"
            : "no-cache",
        );
      },
    }),
  );
  app.use((req, res, next) => {
    if (
      req.method !== "GET" ||
      /^\/(api|rooms|socket\.io|health)(\/|$)/.test(req.path) ||
      /\.[a-z0-9]+$/i.test(req.path) ||
      !req.accepts("html")
    )
      return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile("index.html", { root });
  });
}
app.use((_req, res) =>
  res.status(404).json({ status: "error", message: "Not found" }),
);
app.use(
  (
    err: Error & {
      status?: number;
    },
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    const status =
      err instanceof Fault
        ? err.status
        : err.status === 413
          ? 413
          : err instanceof SyntaxError
            ? 400
            : 500;
    if (status === 429) res.setHeader("Retry-After", "60");
    res.status(status).json({
      status: "error",
      message: status === 500 ? "Internal server error" : err.message,
    });
  },
);
export const httpServer = createServer(app);
export const io = new Server(httpServer, {
  cors: { origin: origins, methods: ["GET", "POST"] },
  maxHttpBufferSize: 8000000,
});
io.use((socket, next) => {
  try {
    rate("connect:" + socket.handshake.address, 300);
    next();
  } catch {
    next(new Error("Too many connections; retry in a minute"));
  }
});
io.on("connection", (socket) => registerRoomHandlers(io, socket));
const timer = setInterval(() => cleanup(false), 60000);
const presenceTimer = setInterval(
  reclaimExpiredParticipants,
  Math.min(RECONNECT_GRACE_MS, 1000),
);
presenceTimer.unref();
timer.unref();
httpServer.on("close", () => {
  clearInterval(timer);
  clearInterval(presenceTimer);
  stopRoomTimers();
});
cleanup();
recoverPresence();
if (require.main === module)
  httpServer.listen(
    Number(process.env.PORT) || 3001,
    process.env.HOST ?? "0.0.0.0",
    () => console.log("PeeDate server listening"),
  );
