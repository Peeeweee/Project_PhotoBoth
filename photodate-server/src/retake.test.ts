import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { io as connect, type Socket } from "socket.io-client";
process.env.DB_PATH = ":memory:";
const { httpServer, io } = require("./index") as typeof import("./index");
const { document, save } = require("./runtime") as typeof import("./runtime");
const { default: db } = require("./db") as typeof import("./db");
const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
const ack = (socket: Socket, event: string, p: unknown) =>
  new Promise<any>((resolve, reject) =>
    socket
      .timeout(2000)
      .emit(event, p, (error: unknown, value: unknown) =>
        error ? reject(error) : resolve(value),
      ),
  );
test("single-shot retakes keep every other capture and edit, require crew approval and reject stale uploads", async () => {
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const base = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`,
    sockets: Socket[] = [];
  const request = async (path: string, body?: unknown, token?: string) => {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: (await response.json()) as any };
  };
  const socket = async () => {
    const value = connect(base, { transports: ["websocket"], forceNew: true });
    sockets.push(value);
    await new Promise<void>((resolve, reject) => {
      value.once("connect", resolve);
      value.once("connect_error", reject);
    });
    return value;
  };
  try {
    const host = (await request("/rooms", { hostName: "Host" })).body,
      code = host.code;
    const guest = (
      await request(`/rooms/${code}/join`, { displayName: "Guest" })
    ).body;
    const hs = await socket(),
      gs = await socket();
    await ack(hs, "join-room", { code, sessionToken: host.sessionToken });
    await ack(gs, "join-room", { code, sessionToken: guest.sessionToken });
    assert.equal(
      (
        await ack(hs, "update-room-selections", {
          code,
          layoutId: "mixed-story",
          designId: "solid-white",
          keepsakeStyle: {
            stripTitle: "A day for the scrapbook",
            filterId: "film",
          },
        })
      ).ok,
      true,
    );
    assert.equal(
      (await ack(hs, "update-room-state", { code, status: "ready" })).ok,
      true,
    );
    assert.equal(
      document(host.roomId).editor.stripTitle,
      "A day for the scrapbook",
    );
    for (const device of [hs, gs]) {
      await ack(device, "capture-ready", { code, ready: true });
      await ack(device, "capture-approval", { code, approved: true });
    }
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 3,
        })
      ).ok,
      true,
    );
    let d = document(host.roomId);
    assert.equal(d.editor.stripTitle, "A day for the scrapbook");
    assert.equal(d.editor.filterId, "film");
    d.shotDeadlines = [1, 1, 1];
    save(host.roomId, d);
    const originalRound = d.roundId!;
    for (const token of [host.sessionToken, guest.sessionToken])
      for (let frame = 0; frame < 3; frame++)
        assert.equal(
          (
            await request(
              `/rooms/${code}/captures`,
              { roundId: originalRound, frameIndex: frame, dataUrl: png },
              token,
            )
          ).status,
          201,
        );
    const before = (
      await request(`/rooms/${code}`, undefined, host.sessionToken)
    ).body;
    assert.equal(before.room.status, "reviewing");
    const editor = {
      assignedPhotos: [png, png, png],
      photoSources: [0, 1, 2],
      photoEdits: Array.from({ length: 3 }, () => ({
        fit: "cover",
        zoom: 1.5,
        x: 10,
        y: -10,
      })),
      stripTitle: "Keep this caption",
      textLayers: [],
    };
    assert.equal(
      (
        await ack(gs, "prepare-retake", {
          code,
          roundId: originalRound,
          frameIndex: 1,
          slotIndexes: [1],
          editor,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "prepare-retake", {
          code,
          roundId: "stale",
          frameIndex: 1,
          slotIndexes: [1],
          editor,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await ack(hs, "prepare-retake", {
          code,
          roundId: originalRound,
          frameIndex: 1,
          slotIndexes: [1],
          editor,
        })
      ).ok,
      true,
    );
    assert.equal(
      (await request(`/rooms/${code}/join`, { displayName: "Too late" }))
        .status,
      409,
    );
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 3,
        })
      ).ok,
      false,
    );
    for (const device of [hs, gs]) {
      await ack(device, "capture-ready", { code, ready: true });
      await ack(device, "capture-approval", { code, approved: true });
    }
    assert.equal(
      (
        await ack(hs, "update-room-state", {
          code,
          status: "capturing",
          frameCount: 3,
        })
      ).ok,
      true,
    );
    const during = (
      await request(`/rooms/${code}`, undefined, host.sessionToken)
    ).body;
    assert.notEqual(during.roundId, originalRound);
    assert.equal(during.captures.length, 4);
    assert.equal(during.shotDeadlines[0], 0);
    assert.equal(during.shotDeadlines[2], 0);
    assert.ok(during.shotDeadlines[1] > 0);
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          { roundId: originalRound, frameIndex: 1, dataUrl: png },
          host.sessionToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          { roundId: during.roundId, frameIndex: 0, dataUrl: png },
          host.sessionToken,
        )
      ).status,
      409,
    );
    d = document(host.roomId);
    d.shotDeadlines[1] = 1;
    save(host.roomId, d);
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          { roundId: during.roundId, frameIndex: 1, dataUrl: png },
          host.sessionToken,
        )
      ).status,
      201,
    );
    assert.equal(
      (await request(`/rooms/${code}`, undefined, host.sessionToken)).body.room
        .status,
      "capturing",
    );
    await request(
      `/rooms/${code}/captures`,
      { roundId: during.roundId, frameIndex: 1, dataUrl: png },
      guest.sessionToken,
    );
    const after = (
      await request(`/rooms/${code}`, undefined, host.sessionToken)
    ).body;
    assert.equal(after.room.status, "reviewing");
    assert.equal(after.captures.length, 6);
    assert.deepEqual(after.editor.photoEdits, editor.photoEdits);
    assert.equal(after.editor.stripTitle, editor.stripTitle);
    assert.equal(after.editor.assignedPhotos[1], "");
    assert.equal(after.editor.photoSources[1], 1);
    for (const row of before.captures.filter(
      (row: any) => row.frame_index !== 1,
    ))
      assert.equal(
        after.captures.find((capture: any) => capture.id === row.id)?.image_url,
        row.image_url,
      );
    assert.equal(
      (
        await request(
          `/rooms/${code}/captures`,
          { roundId: after.roundId, frameIndex: 2, dataUrl: png },
          host.sessionToken,
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await ack(hs, "prepare-retake", {
          code,
          roundId: after.roundId,
          frameIndex: 0,
          slotIndexes: [0],
          editor,
        })
      ).ok,
      true,
    );
    assert.equal(document(host.roomId).retakeFrameIndex, 0);
  } finally {
    for (const socket of sockets) socket.disconnect();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    db.close();
  }
});
