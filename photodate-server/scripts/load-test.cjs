// Isolated local benchmark: never connects to a deployed server or an existing database.
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { performance, monitorEventLoopDelay } = require("node:perf_hooks");
const { deflateSync } = require("node:zlib");
const { randomBytes } = require("node:crypto");
const { io: connect } = require("socket.io-client");
const rooms = Math.max(1, Math.min(25, Number(process.env.LOAD_ROOMS) || 25));
const concurrency = Math.max(
  1,
  Math.min(64, Number(process.env.LOAD_CONCURRENCY) || 16),
);
const folder = mkdtempSync(join(tmpdir(), "photodate-load-"));
process.env.DB_PATH = join(folder, "load.db");
process.env.CLIENT_ORIGINS = "http://localhost:5173";
const { httpServer, io } = require("../dist/index");
const { default: db } = require("../dist/db");
const { document, save } = require("../dist/runtime");
const sockets = [],
  durations = [];
let sentBytes = 0,
  receivedBytes = 0,
  socketBytes = 0,
  retries = 0;
const delay = monitorEventLoopDelay({ resolution: 10 });
function chunk(type, bytes) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([name, bytes])) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, name, bytes, checksum]);
}
const width = 320,
  height = 180,
  header = Buffer.alloc(13);
header.writeUInt32BE(width);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 2;
const pixels = Buffer.alloc((width * 3 + 1) * height);
for (let y = 0; y < height; y++)
  randomBytes(width * 3).copy(pixels, y * (width * 3 + 1) + 1);
const image =
  "data:image/png;base64," +
  Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]).toString("base64");
async function pool(items, work) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        await work(item);
      }
    }),
  );
}
function ack(socket, event, payload) {
  return new Promise((resolve, reject) =>
    socket.timeout(10000).emit(event, payload, (error, response) => {
      if (error) return reject(error);
      if (!response.ok) return reject(new Error(response.error.message));
      resolve(response);
    }),
  );
}
(async () => {
  const started = performance.now();
  try {
    delay.enable();
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    const base = `http://127.0.0.1:${httpServer.address().port}`;
    async function request(path, body, token) {
      const encoded = body === undefined ? undefined : JSON.stringify(body);
      for (let attempt = 0; ; attempt++) {
        const start = performance.now();
        const response = await fetch(base + path, {
          method: encoded === undefined ? "GET" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: encoded,
          signal: AbortSignal.timeout(30000),
        });
        const text = await response.text();
        sentBytes += Buffer.byteLength(encoded || "");
        receivedBytes += Buffer.byteLength(text);
        durations.push(performance.now() - start);
        if (response.status === 503 && attempt < 3) {
          retries++;
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 500));
          continue;
        }
        assert.ok(
          response.ok,
          `${path}: ${response.status} ${text.slice(0, 150)}`,
        );
        return JSON.parse(text);
      }
    }
    const sessions = [];
    await pool(Array.from({ length: rooms }), async () => {
      const host = await request("/rooms", { hostName: "Load host" });
      const members = [{ id: host.hostId, token: host.sessionToken }];
      for (let i = 1; i < 4; i++) {
        const guest = await request(`/rooms/${host.code}/join`, {
          displayName: `Guest ${i}`,
        });
        members.push({ id: guest.participantId, token: guest.sessionToken });
      }
      sessions.push({ ...host, members });
    });
    await pool(
      sessions.flatMap((room) =>
        room.members.map((member) => ({ room, member })),
      ),
      async ({ room, member }) => {
        const socket = connect(base, {
          transports: ["websocket"],
          forceNew: true,
          reconnection: false,
        });
        sockets.push(socket);
        member.socket = socket;
        socket.onAny((event, payload) => {
          socketBytes += Buffer.byteLength(JSON.stringify({ event, payload }));
        });
        await Promise.race([
          once(socket, "connect"),
          once(socket, "connect_error").then(([e]) => {
            throw e;
          }),
        ]);
        await ack(socket, "join-room", {
          code: room.code,
          sessionToken: member.token,
        });
        await ack(socket, "capture-ready", { code: room.code, ready: true });
      },
    );
    for (const room of sessions) {
      for (const member of room.members)
        await ack(member.socket, "capture-approval", {
          code: room.code,
          approved: true,
        });
      await ack(room.members[0].socket, "update-room-state", {
        code: room.code,
        status: "capturing",
        frameCount: 2,
      });
      const d = document(room.roomId);
      d.shotDeadlines = [Date.now() - 100, Date.now() - 50];
      save(room.roomId, d);
      room.roundId = d.roundId;
    }
    const uploadStarted = performance.now();
    await pool(
      sessions.flatMap((room) =>
        room.members.flatMap((member) =>
          [0, 1].map((frameIndex) => ({ room, member, frameIndex })),
        ),
      ),
      async ({ room, member, frameIndex }) => {
        await request(
          `/rooms/${room.code}/captures`,
          {
            participantId: member.id,
            frameIndex,
            roundId: room.roundId,
            dataUrl: image,
          },
          member.token,
        );
      },
    );
    const uploadMs = performance.now() - uploadStarted;
    await pool(
      sessions.flatMap((room) =>
        room.members.map((member) => ({ room, member })),
      ),
      async ({ room, member }) => {
        const state = await request(
          `/rooms/${room.code}/captures`,
          undefined,
          member.token,
        );
        assert.equal(state.captures.length, 8);
        assert.equal(
          new Set(
            state.captures.map((c) => `${c.participant_id}:${c.frame_index}`),
          ).size,
          8,
        );
        assert.equal(
          db.prepare("SELECT status FROM rooms WHERE id=?").get(room.roomId)
            .status,
          "reviewing",
        );
      },
    );
    // Include one shared-editor publish per room, with two image slots.
    await pool(sessions, async (room) => {
      await ack(room.members[0].socket, "update-editor", {
        code: room.code,
        stage: "decorate",
        editor: {
          assignedPhotos: [image, image],
          stripTitle: "Traffic rehearsal",
        },
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    durations.sort((a, b) => a - b);
    console.log(
      JSON.stringify(
        {
          rooms,
          users: sockets.length,
          shotsPerUser: 2,
          uploadConcurrency: concurrency,
          fixtureDataUrlBytes: image.length,
          elapsedMs: Math.round(performance.now() - started),
          uploadPhaseMs: Math.round(uploadMs),
          requests: durations.length,
          httpP50Ms: Math.round(durations[Math.floor(durations.length * 0.5)]),
          httpP95Ms: Math.round(durations[Math.floor(durations.length * 0.95)]),
          httpMaxMs: Math.round(durations.at(-1)),
          requestBodyMB: +(sentBytes / 1048576).toFixed(2),
          responseBodyMB: +(receivedBytes / 1048576).toFixed(2),
          socketPayloadMB: +(socketBytes / 1048576).toFixed(2),
          busyRetries: retries,
          eventLoopP95Ms: +(delay.percentile(95) / 1e6).toFixed(2),
          processRssMB: Math.round(process.memoryUsage().rss / 1048576),
          result: "PASS: all rooms completed with eight unique captures",
        },
        null,
        2,
      ),
    );
  } finally {
    delay.disable();
    sockets.forEach((s) => s.disconnect());
    await new Promise((resolve) => io.close(resolve));
    if (httpServer.listening)
      await new Promise((resolve) => httpServer.close(resolve));
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
