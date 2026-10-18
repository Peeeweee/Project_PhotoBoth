import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import Database from "better-sqlite3";
import { io as connect, type Socket } from "socket.io-client";
process.env.DB_PATH = ":memory:";
process.env.RECONNECT_GRACE_MS = "5000";
const { httpServer, io } = require("./index") as typeof import("./index");
const { default: db } = require("./db") as typeof import("./db");
const { document, save } = require("./runtime") as typeof import("./runtime");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
function ack(socket: Socket, event: string, p: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(2000)
      .emit(event, p, (err: unknown, r: unknown) =>
        err ? reject(err) : resolve(r),
      );
  });
}
test("authenticated multiplayer lifecycle, malformed input, retries, retakes and reconnect", async () => {
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const port = (
    httpServer.address() as {
      port: number;
    }
  ).port;
  const base = `http://127.0.0.1:${port}`;
  const sockets: Socket[] = [];
  async function request(path: string, body?: unknown, token?: string) {
    const r = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: (await r.json()) as any };
  }
  async function socket() {
    const s = connect(base, { transports: ["websocket"], forceNew: true });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.once("connect", resolve);
      s.once("connect_error", reject);
    });
    return s;
  }
  try {
    const host = (await request("/rooms", { hostName: "Host" })).body;
    assert.ok(host.sessionToken);
    const code = host.code;
    assert.equal((await request(`/rooms/${code}`)).status, 401);
    assert.equal((await request(`/rooms/${code}/captures`)).status, 401);
    const guest = (
      await request(`/rooms/${code}/join`, { displayName: "Guest" })
    ).body;
    const hs = await socket(),
      gs = await socket(),
      attacker = await socket();
    assert.equal(
      (
        await ack(attacker, "update-room-state", {
          code,
          participantId: host.hostId,
          status: "capturing",
        })
      ).ok,
      false,
    );
    assert.equal((await ack(attacker, "join-room", null)).ok, false);
    attacker.emit("update-room-state", null);
    assert.equal(
      (await ack(attacker, "join-room", { code, participantId: host.hostId }))
        .ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "join-room", {
          code,
          participantId: host.hostId,
          sessionToken: host.sessionToken,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await ack(gs, "join-room", {
          code,
          participantId: guest.participantId,
          sessionToken: guest.sessionToken,
        })
      ).ok,
      true,
    );
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 1,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "update-room-selections", {
          code,
          layoutId: "3x2",
          designId: "solid-lavender",
          customDesign: {
            id: "solid-lavender",
            name: "Lavender Milk",
            background: "#e9ddff",
            edgeStyle: "postage",
          },
        })
      ).ok,
      true,
    );
    for (const s of [hs, gs])
      assert.equal(
        (await ack(s, "capture-ready", { code, ready: true })).ok,
        true,
      );
    assert.equal(
      (await ack(hs, "update-timer-mode", { code, timerSeconds: 1.2 })).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 1,
        })
      ).ok,
      false,
    ); // cameras alone do not constitute consent
    assert.equal(
      (await ack(hs, "capture-approval", { code, approved: "yes" })).ok,
      false,
    );
    assert.equal(
      (await ack(hs, "capture-approval", { code, approved: true })).ok,
      true,
    );
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 1,
        })
      ).ok,
      false,
    ); // guest has not approved
    await ack(gs, "capture-approval", { code, approved: true });
    await ack(gs, "capture-approval", { code, approved: false });
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 1,
        })
      ).ok,
      false,
    ); // withdrawal blocks start
    await ack(gs, "capture-approval", { code, approved: true });
    await ack(hs, "update-timer-mode", { code, timerSeconds: 3 });
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 1,
        })
      ).ok,
      false,
    ); // timer changes require fresh votes
    for (const s of [hs, gs])
      await ack(s, "capture-approval", { code, approved: true });
    const start = await ack(hs, "update-room-state", {
      code,
      status: "capturing",
      frameCount: 1,
    });
    assert.equal(start.ok, true);
    assert.equal(start.snapshot.room.layout_id, "3x2");
    assert.equal(start.snapshot.editor.designPreset.edgeStyle, "postage");
    const round = start.snapshot.roundId;
    const d = document(host.roomId);
    d.shotDeadlines = [Date.now() - 1000];
    save(host.roomId, d);
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          { roundId: round, frameIndex: 0, dataUrl: "not-image" },
          host.sessionToken,
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          {
            roundId: round,
            frameIndex: 0,
            dataUrl: png,
            participantId: guest.participantId,
          },
          host.sessionToken,
        )
      ).status,
      403,
    );
    const upload = { roundId: round, frameIndex: 0, dataUrl: png };
    assert.equal(
      (await request(`/rooms/${code}/captures`, upload, host.sessionToken))
        .status,
      201,
    );
    assert.equal(
      (await request(`/rooms/${code}/captures`, upload, host.sessionToken))
        .status,
      201,
    );
    assert.equal(
      (await request(`/rooms/${code}`, undefined, host.sessionToken)).body.room
        .status,
      "capturing",
    );
    assert.equal(
      (await request(`/rooms/${code}/captures`, upload, guest.sessionToken))
        .status,
      201,
    );
    let state = (await request(`/rooms/${code}`, undefined, host.sessionToken))
      .body;
    assert.equal(state.room.status, "reviewing");
    assert.equal(state.captures.length, 2);
    assert.equal(
      (await ack(gs, "update-editor", { code, editor: { title: "Attack" } }))
        .ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "update-editor", {
          code,
          editor: { setLayoutId: "attack" },
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "update-room-selections", {
          code,
          layoutId: "2x2",
          designId: "custom-bad",
          customDesign: {},
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "update-editor", {
          code,
          editor: {
            title: "Shared",
            stripTitle: "Our night",
            titlePosition: { x: 25, y: 75 },
          },
          stage: "filter",
        })
      ).ok,
      true,
    );
    const restored = await ack(gs, "join-room", {
      code,
      sessionToken: guest.sessionToken,
    });
    assert.equal(restored.snapshot.editor.title, "Shared");
    assert.deepEqual(restored.snapshot.editor.titlePosition, { x: 25, y: 75 });
    assert.equal(
      (
        await ack(hs, "update-editor", {
          code,
          editor: { titlePosition: { x: -1, y: 50 } },
        })
      ).ok,
      false,
    );
    assert.equal(restored.snapshot.stage, "filter");
    await ack(gs, "capture-ready", { code, ready: false });
    const retake = await ack(hs, "update-room-state", {
      code,
      status: "capturing",
      frameCount: 1,
    });
    assert.equal(retake.ok, false); // every participant must remain ready for the next round
    await ack(gs, "capture-ready", { code, ready: true });
    for (const s of [hs, gs])
      await ack(s, "capture-approval", { code, approved: true });
    const retry = await ack(hs, "update-room-state", {
      code,
      status: "capturing",
      frameCount: 1,
    });
    assert.equal(retry.ok, true);
    assert.notEqual(retry.snapshot.roundId, round);
    assert.equal(retry.snapshot.captures.length, 0);
    assert.equal(
      (await request(`/rooms/${code}/captures`, upload, host.sessionToken))
        .status,
      409,
    );
    const guestDevice = await socket();
    await ack(guestDevice, "join-room", {
      code,
      sessionToken: guest.sessionToken,
    });
    assert.equal((await ack(gs, "leave-room", { code })).ok, true);
    assert.equal(
      io.sockets.sockets.get(guestDevice.id!)?.rooms.has(host.roomId),
      false,
    );
    assert.equal(
      (await ack(guestDevice, "capture-ready", { code, ready: true })).ok,
      false,
    );
    assert.equal(
      (await request(`/rooms/${code}`, undefined, guest.sessionToken)).status,
      401,
    );
    const dir = mkdtempSync(join(tmpdir(), "photodate-backup-"));
    try {
      const file = join(dir, "restored.db");
      await db.backup(file);
      const restored = new Database(file);
      assert.equal(
        (
          restored.prepare("SELECT count(*) n FROM rooms").get() as {
            n: number;
          }
        ).n,
        1,
      );
      assert.equal(
        (restored.pragma("foreign_key_check") as unknown[]).length,
        0,
      );
      restored.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    assert.equal((db.pragma("foreign_key_check") as unknown[]).length, 0);
    assert.equal(db.pragma("user_version", { simple: true }), 3);
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    db.close();
  }
});
test("legacy two-slot database migrates transactionally without losing valid rows", () => {
  const dir = mkdtempSync(join(tmpdir(), "photodate-migrate-"));
  try {
    const file = join(dir, "legacy.db"),
      legacy = new Database(file);
    legacy.exec(
      readFileSync(join(__dirname, "schema.sql"), "utf8").replace(
        "BETWEEN 0 AND 3",
        "BETWEEN 0 AND 1",
      ),
    );
    legacy
      .prepare("INSERT INTO rooms(id,code,host_id) VALUES('r','ABCDE','p')")
      .run();
    legacy
      .prepare(
        "INSERT INTO participants(id,room_id,display_name,slot_index) VALUES('p','r','Host',0)",
      )
      .run();
    legacy
      .prepare(
        "INSERT INTO captures(id,room_id,participant_id,frame_index,image_url) VALUES('c','r','p',0,'legacy')",
      )
      .run();
    legacy.close();
    execFileSync(
      process.execPath,
      [
        "-e",
        `const db=require(${JSON.stringify(join(__dirname, "db.js"))}).default;db.close();`,
      ],
      { env: { ...process.env, DB_PATH: file } },
    );
    const migrated = new Database(file);
    assert.equal(migrated.pragma("user_version", { simple: true }), 3);
    assert.equal(
      (
        migrated.prepare("SELECT count(*) n FROM captures").get() as {
          n: number;
        }
      ).n,
      1,
    );
    migrated
      .prepare(
        "INSERT INTO participants(id,room_id,display_name,slot_index) VALUES('p3','r','Third',2)",
      )
      .run();
    assert.throws(() =>
      migrated
        .prepare(
          "INSERT INTO captures(id,room_id,participant_id,frame_index,image_url) VALUES('bad','wrong','p',0,'x')",
        )
        .run(),
    );
    assert.equal((migrated.pragma("foreign_key_check") as unknown[]).length, 0);
    const usage = (scope: string) =>
      (
        migrated
          .prepare("SELECT bytes FROM capture_storage WHERE scope=?")
          .get(scope) as { bytes: number } | undefined
      )?.bytes ?? 0;
    assert.equal(usage("*"), "legacy".length);
    migrated
      .prepare("UPDATE captures SET image_url='replacement' WHERE id='c'")
      .run();
    assert.equal(usage("*"), "replacement".length);
    assert.equal(usage("r"), "replacement".length);
    migrated.pragma("foreign_keys = ON");
    migrated.prepare("DELETE FROM rooms WHERE id='r'").run();
    assert.equal(usage("*"), 0);
    assert.equal(usage("r"), 0);
    migrated.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("pattern CSS allows builtin declarations and rejects injected styles", () => {
  const { design } = require("./runtime") as typeof import("./runtime");
  const grid = {
    id: "pat-grid",
    name: "Grid",
    background: "#ffffff",
    filterCss:
      "background-image: linear-gradient(var(--c-border) 1px, transparent 1px), linear-gradient(90deg, var(--c-border) 1px, transparent 1px); background-size: 20px 20px;",
  };
  assert.match(design(grid).filterCss!, /background-size: 20px 20px;/);
  assert.match(
    design({
      ...grid,
      id: "pat-dots",
      filterCss:
        "background-size: 20px 20px; background-position: 0 0, 10px 10px;",
    }).filterCss!,
    /background-position/,
  );
  for (const filterCss of [
    "position: fixed;",
    "background-image: url(https://evil.example/image);",
    "background-image: url(data:image/svg+xml,evil);",
    "background-image: u\\rl(evil);",
    "background-size: 10px; color: red;",
    "background-image: none;} body {color:red",
  ])
    assert.throws(() => design({ ...grid, filterCss }));
});
test("custom upload background syntax survives safe design serialization", () => {
  const { design } = require("./runtime") as typeof import("./runtime");
  assert.equal(
    design({
      id: "custom-upload",
      name: "Upload",
      background: `url("${png}") center / cover no-repeat, #fff`,
    }).id,
    "custom-upload",
  );
  assert.throws(() =>
    design({
      id: "custom-upload",
      name: "Upload",
      background: `url("${png}") center / cover no-repeat, url(https://evil.example)`,
    }),
  );
});
