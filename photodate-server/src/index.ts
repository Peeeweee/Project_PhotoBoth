import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import rooms from "./routes/rooms";
import { registerRoomHandlers, stopRoomTimers } from "./socket/roomHandlers";
import { cleanup, Fault, rate } from "./runtime";
export const app = express();
const origins = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());
app.disable("x-powered-by");
app.use(cors({ origin: origins, methods: ["GET", "POST"] }));
app.use((req, _res, next) => {
  try {
    rate("http:" + req.ip);
    next();
  } catch (e) {
    next(e);
  }
});
app.use(express.json({ limit: "8mb" }));
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/rooms", rooms);
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
    res
      .status(status)
      .json({
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
    rate("connect:" + socket.handshake.address, 30);
    next();
  } catch {
    next(new Error("Too many connections; retry in a minute"));
  }
});
io.on("connection", (socket) => registerRoomHandlers(io, socket));
const timer = setInterval(cleanup, 60000);
timer.unref();
httpServer.on("close", () => {
  clearInterval(timer);
  stopRoomTimers();
});
cleanup();
if (require.main === module)
  httpServer.listen(
    Number(process.env.PORT) || 3001,
    process.env.HOST ?? "0.0.0.0",
    () => console.log("PhotoDate server listening"),
  );
