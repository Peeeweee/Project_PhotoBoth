import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { setTimeout as pause } from "node:timers/promises";
import { io as connect, type Socket } from "socket.io-client";
process.env.DB_PATH = ":memory:";
process.env.RECONNECT_GRACE_MS = "5000";
const { httpServer, io } = require("./index") as typeof import("./index");
const {
  default: db,
  roomQueries,
  participantQueries,
} = require("./db") as typeof import("./db");
const {
  reclaimExpiredParticipants,
  recoverPresence,
  document,
  save,
  online,
  changed,
} = require("./runtime") as typeof import("./runtime");
function ack(socket: Socket, event: string, payload: unknown): Promise<any> {
  return new Promise((resolve, reject) =>
    socket
      .timeout(1500)
      .emit(event, payload, (error: unknown, response: unknown) =>
        error ? reject(error) : resolve(response),
      ),
  );
}
async function eventually(check: () => boolean) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await pause(10);
  }
  assert.ok(check(), "Expected server state did not arrive within 2s");
}
test("room entry API and socket lifecycle simulations", async (t) => {
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const port = (httpServer.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`,
    sockets: Socket[] = [];
  async function request(path: string, body?: unknown, token?: string) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    });
    return { status: response.status, body: (await response.json()) as any };
  }
  async function create(name = "Host") {
    const result = await request("/rooms", { hostName: name });
    assert.equal(result.status, 201);
    return result.body;
  }
  async function socket() {
    const s = connect(base, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
      timeout: 1500,
    });
    sockets.push(s);
    await new Promise<void>((resolve, reject) => {
      s.once("connect", resolve);
      s.once("connect_error", reject);
    });
    return s;
  }
  async function enter(s: Socket, room: any, session: any) {
    const result = await ack(s, "join-room", {
      code: room.code,
      participantId: session.participantId ?? session.hostId,
      sessionToken: session.sessionToken,
    });
    assert.equal(result.ok, true, JSON.stringify(result));
    return result;
  }
  function expire(id: string) {
    db.prepare(
      "UPDATE participant_leases SET expires_at=? WHERE participant_id=?",
    ).run(Date.now() - 1, id);
    reclaimExpiredParticipants();
  }
  try {
    await t.test(
      "reject malformed/unknown codes and names without orphaning rows",
      async () => {
        assert.equal((await request("/health")).status, 200);
        assert.equal((await request("/rooms", { hostName: " " })).status, 400);
        assert.equal(
          (await request("/rooms/AB12C/join", { displayName: "Guest" })).status,
          400,
        );
        assert.equal(
          (await request("/rooms/ZZZZZ/join", { displayName: "Guest" })).status,
          404,
        );
        assert.equal((await request("/rooms/null/join", null)).status, 400);
        const malformed = await fetch(base + "/rooms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{",
        });
        assert.equal(malformed.status, 400);
        assert.equal(
          (db.prepare("SELECT count(*) n FROM rooms").get() as { n: number }).n,
          0,
        );
      },
    );
    const host = await create(),
      hs = await socket();
    await enter(hs, host, host);
    let sessions: any[] = [];
    await t.test(
      "six concurrent guests fill exactly three unique slots; retries reuse membership",
      async () => {
        const results = await Promise.all(
          Array.from({ length: 6 }, (_, i) =>
            request(
              `/rooms/${encodeURIComponent(" " + host.code.toLowerCase() + " ")}/join`,
              { displayName: `Guest ${i}` },
            ),
          ),
        );
        sessions = results.filter((r) => r.status === 201).map((r) => r.body);
        assert.equal(sessions.length, 3);
        assert.equal(results.filter((r) => r.status === 409).length, 3);
        assert.deepEqual(sessions.map((s) => s.slotIndex).sort(), [1, 2, 3]);
        for (const member of [host, ...sessions]) {
          const retry = await request(
            `/rooms/${host.code}/join`,
            {},
            member.sessionToken,
          );
          assert.equal(retry.status, 200);
          assert.equal(
            retry.body.participantId,
            member.participantId ?? member.hostId,
          );
          assert.equal(retry.body.sessionToken, member.sessionToken);
        }
        assert.equal(participantQueries.countInRoom(host.roomId), 4);
        assert.equal(
          (
            await request(
              `/rooms/${host.code}/join`,
              { displayName: "Fake" },
              "forged",
            )
          ).status,
          401,
        );
        assert.equal(
          (await request(`/rooms/${host.code}/join`, { displayName: "" }))
            .status,
          400,
        );
      },
    );
    const gs = await socket(),
      secondDevice = await socket();
    await enter(gs, host, sessions[0]);
    await enter(secondDevice, host, sessions[0]);
    await t.test(
      "repeat socket joins preserve readiness; one device disconnect does not mark another offline",
      async () => {
        await ack(gs, "capture-ready", { code: host.code, ready: true });
        await enter(gs, host, sessions[0]);
        assert.ok(
          document(host.roomId).readyParticipantIds.includes(
            sessions[0].participantId,
          ),
        );
        gs.disconnect();
        await eventually(
          () => online.get(sessions[0].participantId)?.size === 1,
        );
        assert.ok(
          document(host.roomId).readyParticipantIds.includes(
            sessions[0].participantId,
          ),
        );
        const state = await request(
          `/rooms/${host.code}`,
          undefined,
          host.sessionToken,
        );
        assert.equal(
          state.body.participants.find(
            (p: any) => p.id === sessions[0].participantId,
          ).online,
          true,
        );
      },
    );
    await t.test(
      "explicit leave evicts all devices, revokes credentials, and frees a slot",
      async () => {
        assert.equal(
          (
            await request(
              `/rooms/${host.code}/leave`,
              {},
              sessions[0].sessionToken,
            )
          ).status,
          200,
        );
        assert.equal(
          io.sockets.sockets.get(secondDevice.id!)?.rooms.has(host.roomId),
          false,
        );
        assert.equal(
          (
            await request(
              `/rooms/${host.code}`,
              undefined,
              sessions[0].sessionToken,
            )
          ).status,
          401,
        );
        const replacement = await request(`/rooms/${host.code}/join`, {
          displayName: "Replacement",
        });
        assert.equal(replacement.status, 201);
        assert.equal(replacement.body.slotIndex, sessions[0].slotIndex);
        sessions[0] = replacement.body;
      },
    );
    await t.test(
      "REST-only abandoned reservations expire and immediately release capacity",
      async () => {
        expire(sessions[0].participantId);
        assert.equal(
          participantQueries.findById(sessions[0].participantId),
          undefined,
        );
        const replacement = await request(`/rooms/${host.code}/join`, {
          displayName: "Reservation recovered",
        });
        assert.equal(replacement.status, 201);
        assert.equal(replacement.body.slotIndex, sessions[0].slotIndex);
        sessions[0] = replacement.body;
      },
    );
    await t.test(
      "maintenance timer reclaims an abandoned reservation without another HTTP request",
      async () => {
        const abandoned = sessions[2].participantId;
        db.prepare(
          "UPDATE participant_leases SET expires_at=? WHERE participant_id=?",
        ).run(Date.now() - 1, abandoned);
        await eventually(() => !participantQueries.findById(abandoned));
        assert.equal(participantQueries.countInRoom(host.roomId), 3);
      },
    );
    await t.test(
      "started rooms reject new guests while existing credentials resume idempotently",
      async () => {
        roomQueries.setStatus(host.roomId, "capturing");
        assert.equal(
          (await request(`/rooms/${host.code}/join`, { displayName: "Late" }))
            .status,
          409,
        );
        const resume = await request(
          `/rooms/${host.code}/join`,
          {},
          sessions[1].sessionToken,
        );
        assert.equal(resume.status, 200);
        assert.equal(resume.body.room.status, "capturing");
        roomQueries.setStatus(host.roomId, "closed");
        changed(host.roomId);
        assert.equal(
          (
            await request(
              `/rooms/${host.code}/join`,
              {},
              sessions[1].sessionToken,
            )
          ).status,
          410,
        );
        assert.equal(
          (await request(`/rooms/${host.code}`, undefined, host.sessionToken))
            .status,
          410,
        );
      },
    );
    await t.test(
      "reconnect restores the same member before grace; host expiry closes room for connected guests",
      async () => {
        const room = await create("Reconnect host"),
          guest = (
            await request(`/rooms/${room.code}/join`, {
              displayName: "Waiting guest",
            })
          ).body;
        const hostSocket = await socket(),
          guestSocket = await socket();
        await enter(hostSocket, room, room);
        await enter(guestSocket, room, guest);
        hostSocket.disconnect();
        await eventually(() => !online.has(room.hostId));
        assert.equal(roomQueries.findById(room.roomId)?.status, "waiting");
        const resumed = await socket();
        const result = await enter(resumed, room, room);
        assert.equal(result.snapshot.participants.length, 2);
        assert.equal(
          (
            db
              .prepare(
                "SELECT expires_at FROM participant_leases WHERE participant_id=?",
              )
              .get(room.hostId) as { expires_at: number | null }
          ).expires_at,
          null,
        );
        const closed = new Promise<any>((resolve) =>
          guestSocket.on("room-state-changed", (p) => {
            if (p.status === "closed") resolve(p);
          }),
        );
        resumed.disconnect();
        await eventually(() => !online.has(room.hostId));
        expire(room.hostId);
        await closed;
        assert.equal(roomQueries.findById(room.roomId)?.status, "closed");
        assert.equal(
          io.sockets.sockets.get(guestSocket.id!)?.rooms.has(room.roomId),
          false,
        );
        assert.equal(online.has(guest.participantId), false);
      },
    );
    await t.test(
      "never-connected hosts expire; expired rooms and revoked credentials cannot reopen sessions",
      async () => {
        const room = await create("Abandoned host");
        expire(room.hostId);
        assert.equal(roomQueries.findById(room.roomId)?.status, "closed");
        assert.equal(
          (await request(`/rooms/${room.code}/join`, { displayName: "Late" }))
            .status,
          410,
        );
        const old = await create("Expired");
        db.prepare("UPDATE rooms SET created_at=? WHERE id=?").run(
          "2000-01-01T00:00:00.000Z",
          old.roomId,
        );
        const expired = await request(`/rooms/${old.code}/join`, {
          displayName: "Late",
        });
        assert.ok([404, 410].includes(expired.status));
      },
    );
    await t.test(
      "restart recovery grants grace, aborts stale capture timing, and reclaims old members",
      async () => {
        const room = await create("Restart host"),
          guest = (
            await request(`/rooms/${room.code}/join`, {
              displayName: "Restart guest",
            })
          ).body;
        roomQueries.setStatus(room.roomId, "capturing");
        const d = document(room.roomId);
        d.roundId = "stale-round";
        d.readyParticipantIds = [room.hostId, guest.participantId];
        d.expectedParticipantIds = [room.hostId, guest.participantId];
        d.shotDeadlines = [1];
        save(room.roomId, d);
        db.prepare(
          "UPDATE participant_leases SET expires_at=NULL WHERE participant_id IN (?,?)",
        ).run(room.hostId, guest.participantId);
        recoverPresence();
        assert.equal(roomQueries.findById(room.roomId)?.status, "ready");
        assert.equal(document(room.roomId).roundId, null);
        assert.equal(document(room.roomId).stage, "capture");
        assert.deepEqual(document(room.roomId).readyParticipantIds, []);
        const lease = db
          .prepare(
            "SELECT expires_at FROM participant_leases WHERE participant_id=?",
          )
          .get(room.hostId) as { expires_at: number };
        assert.ok(lease.expires_at > Date.now());
        assert.equal(
          (await request(`/rooms/${room.code}/join`, {}, room.sessionToken))
            .status,
          200,
        );
        expire(guest.participantId);
        assert.equal(
          participantQueries.findById(guest.participantId),
          undefined,
        );
        expire(room.hostId);
        assert.equal(roomQueries.findById(room.roomId)?.status, "closed");
      },
    );
    assert.equal((db.pragma("foreign_key_check") as unknown[]).length, 0);
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    db.close();
  }
});
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
test("on-disk sessions survive restart and expired leases are not renewed", () => {
  const dir = mkdtempSync(join(tmpdir(), "photodate-restart-"));
  const file = join(dir, "session.db");
  const dbPath = JSON.stringify(join(__dirname, "db.js")),
    runtimePath = JSON.stringify(join(__dirname, "runtime.js")),
    indexPath = JSON.stringify(join(__dirname, "index.js"));
  function run(script: string, token = "") {
    return JSON.parse(
      execFileSync(process.execPath, ["-e", script], {
        env: {
          ...process.env,
          DB_PATH: file,
          RECONNECT_GRACE_MS: "5000",
          PHOTO_TEST_TOKEN: token,
        },
        encoding: "utf8",
        timeout: 10000,
      }).trim(),
    );
  }
  try {
    const created = run(
      `const {default:db,roomQueries,participantQueries}=require(${dbPath});const r=require(${runtimePath});roomQueries.create({id:'r',code:'ABCDE',host_id:'p',theme_pack_id:null,layout_id:null,design_id:null,timer_seconds:3,status:'capturing'});participantQueries.create({id:'p',room_id:'r',display_name:'Host',slot_index:0});const token=r.issue('r','p');r.markParticipantConnected('p');const d=r.document('r');d.readyParticipantIds=['p'];d.roundId='old-round';d.shotDeadlines=[1];r.save('r',d);console.log(JSON.stringify({token}));db.close();`,
    );
    const recovered = run(
      `const server=require(${indexPath});const {default:db,roomQueries}=require(${dbPath});const r=require(${runtimePath});const p=r.authenticate(roomQueries.findById('r'),process.env.PHOTO_TEST_TOKEN);console.log(JSON.stringify({id:p.id,snapshot:r.snapshot('r'),lease:db.prepare('SELECT expires_at FROM participant_leases WHERE participant_id=?').get('p')}));server.io.close();db.close();`,
      created.token,
    );
    assert.equal(recovered.id, "p");
    assert.equal(recovered.snapshot.room.status, "ready");
    assert.equal(recovered.snapshot.roundId, null);
    assert.deepEqual(recovered.snapshot.readyParticipantIds, []);
    assert.ok(recovered.lease.expires_at > Date.now());
    const expired = run(
      `const {default:db}=require(${dbPath});db.prepare('UPDATE participant_leases SET expires_at=?').run(Date.now()-1);const server=require(${indexPath});console.log(JSON.stringify(db.prepare('SELECT status FROM rooms WHERE id=?').get('r')));server.io.close();db.close();`,
    );
    assert.equal(expired.status, "closed");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
