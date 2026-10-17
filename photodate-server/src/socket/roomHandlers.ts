import type { ClientToServerEvents } from "../../../shared/contracts";
import type { Server, Socket } from "socket.io";
import { randomUUID } from "crypto";
import {
  roomQueries,
  participantQueries,
  captureQueries,
  type RoomStatus,
} from "../db";
import {
  assert,
  object,
  roomByCode,
  authenticate,
  document,
  save,
  snapshot,
  changed,
  changes,
  online,
  rate,
  Fault,
  complete,
  layouts,
  designs,
  design,
  editorDocument,
} from "../runtime";
const grace = new Map<string, ReturnType<typeof setTimeout>>();
const transitions: Record<string, string[]> = {
  waiting: ["ready", "capturing"],
  ready: ["ready", "capturing", "waiting"],
  capturing: ["reviewing", "waiting"],
  reviewing: ["editing", "capturing", "waiting"],
  editing: ["exporting", "capturing", "waiting", "ready"],
  exporting: ["closed", "capturing", "waiting", "ready"],
};
export function registerRoomHandlers(io: Server, socket: Socket) {
  const publish = (id: string) => {
    const s = snapshot(id);
    io.to(id).emit("room-snapshot", { ...s, captures: undefined });
    io.to(id).emit("participant-list-updated", {
      roomId: id,
      participants: s.participants,
    });
    if (s.room)
      io.to(id).emit("room-state-changed", {
        roomId: id,
        status: s.room.status,
        changedAt: new Date().toISOString(),
      });
    for (const other of io.sockets.sockets.values()) {
      if (
        other.data.roomId === id &&
        (s.room?.status === "closed" ||
          !s.participants.some((p) => p.id === other.data.participantId))
      ) {
        other.leave(id);
        other.data = {};
      }
    }
  };
  if (!changes.listenerCount("room")) changes.on("room", publish);
  function bind(
    event: keyof ClientToServerEvents,
    fn: (p: Record<string, any>) => unknown,
  ) {
    socket.on(event, (raw: unknown, ack: unknown) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try {
        rate(`socket:${socket.id}`, 180);
        const p = object(raw);
        reply({ ok: true, ...(fn(p) ?? {}) });
      } catch (e) {
        reply({
          ok: false,
          error: {
            code: e instanceof Fault ? `HTTP_${e.status}` : "INTERNAL_ERROR",
            message:
              e instanceof Fault ? e.message : "Could not complete request",
          },
        });
      }
    });
  }
  function member(p: Record<string, any>, host = false) {
    assert(
      socket.data.roomId && socket.data.participantId,
      "Join with your session credential first",
      401,
    );
    const room = roomByCode(p.code ?? socket.data.roomCode);
    assert(room.id === socket.data.roomId, "Wrong room", 403);
    const participant = authenticate(room, socket.data.sessionToken);
    assert(
      !p.participantId || p.participantId === participant.id,
      "Wrong participant",
      403,
    );
    if (host)
      assert(
        room.host_id === participant.id,
        "Only the host may perform this action",
        403,
      );
    return { room, participant };
  }
  function offline() {
    const id = socket.data.participantId as string | undefined,
      roomId = socket.data.roomId as string | undefined;
    if (!id || !roomId) return;
    online.get(id)?.delete(socket.id);
    if (!online.get(id)?.size) {
      online.delete(id);
      const d = document(roomId);
      d.readyParticipantIds = d.readyParticipantIds.filter((p) => p !== id);
      save(roomId, d);
      if (!grace.has(id)) {
        const timer = setTimeout(
          () => {
            grace.delete(id);
            const room = roomQueries.findById(roomId);
            if (room) {
              if (room.host_id === id) roomQueries.setStatus(roomId, "closed");
              else participantQueries.delete(id);
              const doc = document(roomId);
              doc.expectedParticipantIds = doc.expectedParticipantIds.filter(
                (p) => p !== id,
              );
              save(roomId, doc);
              complete(roomId);
              changed(roomId);
            }
          },
          Number(process.env.RECONNECT_GRACE_MS) || 120000,
        );
        timer.unref();
        grace.set(id, timer);
      }
    }
    changed(roomId);
  }
  bind("join-room", (p) => {
    const room = roomByCode(p.code),
      participant = authenticate(
        room,
        p.sessionToken ?? socket.handshake.auth.sessionToken,
      );
    assert(
      !p.participantId || p.participantId === participant.id,
      "Wrong participant",
      403,
    );
    if (socket.data.roomId) {
      offline();
      socket.leave(socket.data.roomId);
    }
    socket.data = {
      roomId: room.id,
      roomCode: room.code,
      participantId: participant.id,
      sessionToken: p.sessionToken ?? socket.handshake.auth.sessionToken,
    };
    const timer = grace.get(participant.id);
    if (timer) {
      clearTimeout(timer);
      grace.delete(participant.id);
    }
    const ids = online.get(participant.id) ?? new Set<string>();
    ids.add(socket.id);
    online.set(participant.id, ids);
    socket.join(room.id);
    changed(room.id);
    return { snapshot: snapshot(room.id) };
  });
  bind("leave-room", (p) => {
    const { room, participant } = member(p);
    if (participant.id === room.host_id)
      roomQueries.setStatus(room.id, "closed");
    else participantQueries.delete(participant.id);
    const d = document(room.id);
    d.readyParticipantIds = d.readyParticipantIds.filter(
      (id) => id !== participant.id,
    );
    d.expectedParticipantIds = d.expectedParticipantIds.filter(
      (id) => id !== participant.id,
    );
    save(room.id, d);
    online.delete(participant.id);
    const timer = grace.get(participant.id);
    if (timer) clearTimeout(timer);
    grace.delete(participant.id);
    for (const other of io.sockets.sockets.values()) {
      if (other.data.participantId === participant.id) {
        other.leave(room.id);
        other.data = {};
      }
    }
    socket.data = {};
    complete(room.id);
    changed(room.id);
  });
  bind("capture-ready", (p) => {
    const { room, participant } = member(p);
    assert(typeof p.ready === "boolean", "ready must be boolean");
    const d = document(room.id);
    d.readyParticipantIds = d.readyParticipantIds.filter(
      (id) => id !== participant.id,
    );
    if (p.ready) d.readyParticipantIds.push(participant.id);
    save(room.id, d);
    changed(room.id);
  });
  bind("update-room-state", (p) => {
    const { room } = member(p, true);
    assert(
      typeof p.status === "string" &&
        (transitions[room.status] ?? []).includes(p.status),
      "Invalid transition",
      409,
    );
    const d = document(room.id);
    if (p.status === "capturing") {
      const people = participantQueries.findByRoom(room.id);
      assert(
        people.length > 0 &&
          people.every(
            (p) => online.has(p.id) && d.readyParticipantIds.includes(p.id),
          ),
        "Every participant must connect and enable their camera first",
        409,
      );
      const n = p.frameCount ?? 4;
      assert(
        Number.isInteger(n) && n >= 1 && n <= 12,
        "frameCount must be 1–12",
      );
      d.roundId = randomUUID();
      d.frameCount = n;
      d.shotDeadlines = Array.from(
        { length: n },
        (_, i) =>
          Date.now() + 1500 + (i + 1) * Math.max(1, room.timer_seconds) * 1000,
      );
      d.expectedParticipantIds = people.map((p) => p.id);
      d.editor = d.customDesign ? { designPreset: d.customDesign } : {};
      d.stage = "capture";
      captureQueries.deleteByRoom(room.id);
    }
    if (p.status === "reviewing") {
      const rows = captureQueries.findByRoom(room.id);
      assert(
        d.expectedParticipantIds.every(
          (id) =>
            rows.filter(
              (c) => c.participant_id === id && c.round_id === d.roundId,
            ).length === d.frameCount,
        ),
        "Waiting for participant uploads",
        409,
      );
      d.stage = "review";
    }
    if (p.status === "ready") {
      d.stage = "capture";
      d.roundId = null;
      d.readyParticipantIds = [];
      d.expectedParticipantIds = [];
      d.editor = d.customDesign ? { designPreset: d.customDesign } : {};
      captureQueries.deleteByRoom(room.id);
    }
    if (p.status === "waiting") {
      d.roundId = null;
      d.readyParticipantIds = [];
      d.expectedParticipantIds = [];
      d.editor = {};
      d.stage = "editor";
      captureQueries.deleteByRoom(room.id);
    }
    if (p.status === "editing") d.stage = "editor";
    if (p.status === "exporting") d.stage = "export";
    save(room.id, d);
    roomQueries.setStatus(room.id, p.status as RoomStatus);
    changed(room.id);
    return { snapshot: snapshot(room.id) };
  });
  bind("update-timer-mode", (p) => {
    const { room } = member(p, true);
    assert(
      room.status !== "capturing",
      "Cannot change timer during capture",
      409,
    );
    assert(
      Number.isInteger(p.timerSeconds) &&
        p.timerSeconds >= 0 &&
        p.timerSeconds <= 10,
      "Timer must be integer 0–10",
    );
    roomQueries.setTimerSeconds(room.id, p.timerSeconds);
    io.to(room.id).emit("timer-mode-changed", {
      roomId: room.id,
      timerSeconds: p.timerSeconds,
    });
    changed(room.id);
  });
  bind("update-room-selections", (p) => {
    const { room } = member(p, true);
    assert(
      room.status !== "capturing",
      "Cannot change selections during capture",
      409,
    );
    for (const k of ["layoutId", "designId"])
      assert(
        p[k] === null ||
          (typeof p[k] === "string" && /^[\w-]{1,100}$/.test(p[k])),
        `Invalid ${k}`,
      );
    assert(
      p.layoutId === null || layouts.includes(p.layoutId),
      "Unknown layout",
    );
    assert(
      p.designId === null || designs.includes(p.designId) || p.customDesign,
      "Unknown design",
    );
    const d = document(room.id);
    if (p.customDesign) {
      const custom = design(p.customDesign);
      assert(custom.id === p.designId, "Design identity mismatch");
      assert(
        JSON.stringify(custom).length < 3000000,
        "Custom design too large",
        413,
      );
      d.customDesign = custom;
      d.editor.designPreset = custom;
    } else d.customDesign = null;
    save(room.id, d);
    roomQueries.setSelections(room.id, {
      themePackId: room.theme_pack_id,
      layoutId: p.layoutId,
      designId: p.designId,
      timerSeconds: room.timer_seconds,
    });
    io.to(room.id).emit("room-selections-changed", {
      roomId: room.id,
      layoutId: p.layoutId,
      designId: p.designId,
      customDesign: d.customDesign,
    });
    changed(room.id);
  });
  bind("update-editor", (p) => {
    const { room } = member(p, true);
    assert(
      ["reviewing", "editing", "exporting"].includes(room.status),
      "Editor not available",
      409,
    );
    const editor = editorDocument(p.editor);
    assert(
      JSON.stringify(editor).length <= 6000000,
      "Editor document too large",
      413,
    );
    const stage = p.stage ?? document(room.id).stage;
    assert(
      ["editor", "filter", "decorate", "export", "done"].includes(stage),
      "Invalid stage",
    );
    const d = document(room.id);
    d.editor = editor;
    d.stage = stage;
    save(room.id, d);
    io.to(room.id).emit("editor-state-changed", {
      roomId: room.id,
      editor,
      stage,
      version: d.version,
    });
    changed(room.id);
  });
  bind("simulate-group", () => {
    throw new Fault(
      409,
      "Demo participants disabled; invite real participants.",
    );
  });
  socket.on("disconnect", () => {
    try {
      offline();
    } catch {}
  });
}
export function stopRoomTimers() {
  for (const timer of grace.values()) clearTimeout(timer);
  grace.clear();
  online.clear();
  changes.removeAllListeners("room");
}
