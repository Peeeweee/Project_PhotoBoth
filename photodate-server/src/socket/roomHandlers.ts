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
  customLayout,
  reserveParticipant,
  markParticipantConnected,
  reclaimExpiredParticipants,
  removeParticipant,
  leaveReason,
} from "../runtime";
const transitions: Record<string, string[]> = {
  waiting: ["ready", "capturing"],
  ready: ["ready", "capturing", "waiting"],
  capturing: ["reviewing", "waiting", "ready"],
  reviewing: ["editing", "capturing", "waiting"],
  editing: ["exporting", "capturing", "waiting", "ready"],
  exporting: ["closed", "capturing", "waiting", "ready"],
};
function keepsakeStyle(editor: Record<string, unknown>) {
  return Object.fromEntries(
    ["stripTitle", "titleStyle", "titlePosition", "filterId"]
      .filter((key) => editor[key] !== undefined)
      .map((key) => [key, editor[key]]),
  );
}
export function registerRoomHandlers(io: Server, socket: Socket) {
  const publish = (id: string) => {
    const s = snapshot(id, false);
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
      d.approvedParticipantIds = [];
      save(roomId, d);
      reserveParticipant(id);
    }
    changed(roomId);
  }
  bind("join-room", (p) => {
    reclaimExpiredParticipants();
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
    if (
      socket.data.roomId &&
      (socket.data.roomId !== room.id ||
        socket.data.participantId !== participant.id)
    ) {
      offline();
      socket.leave(socket.data.roomId);
    }
    socket.data = {
      roomId: room.id,
      roomCode: room.code,
      participantId: participant.id,
      sessionToken: p.sessionToken ?? socket.handshake.auth.sessionToken,
    };
    markParticipantConnected(participant.id);
    const ids = online.get(participant.id) ?? new Set<string>();
    ids.add(socket.id);
    online.set(participant.id, ids);
    socket.join(room.id);
    changed(room.id);
    return { snapshot: snapshot(room.id) };
  });
  bind("leave-room", (p) => {
    const { room, participant } = member(p);
    removeParticipant(room.id, participant.id, leaveReason(p.reason));
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
  bind("capture-approval", (p) => {
    const { room, participant } = member(p);
    assert(room.status !== "capturing", "Shots have already started", 409);
    assert(typeof p.approved === "boolean", "approved must be boolean");
    const d = document(room.id);
    const roster = participantQueries
      .findByRoom(room.id)
      .map((p) => p.id)
      .sort()
      .join(",");
    if (d.approvalRoster !== roster) d.approvedParticipantIds = [];
    d.approvalRoster = roster;
    d.approvedParticipantIds = d.approvedParticipantIds.filter(
      (id) => id !== participant.id,
    );
    if (p.approved) {
      assert(
        d.readyParticipantIds.includes(participant.id),
        "Enable your camera before approving",
        409,
      );
      d.approvedParticipantIds.push(participant.id);
    }
    save(room.id, d);
    changed(room.id);
  });
  const publishCollaboration = (roomId: string) => {
    const d = document(roomId);
    io.to(roomId).emit("collaboration-changed", {
      roomId,
      messages: d.messages,
      photoVotes: d.photoVotes,
      roundId: d.roundId,
      reviewApprovals: d.reviewApprovals,
      reviewRevision: d.reviewRevision,
    });
  };
  bind("send-message", (p) => {
    const { room, participant } = member(p);
    rate(`chat:${participant.id}`, 20);
    assert(
      typeof p.text === "string" &&
        p.text.trim().length > 0 &&
        p.text.length <= 500,
      "Messages must contain 1–500 characters",
    );
    const d = document(room.id);
    d.messages.push({
      id: randomUUID(),
      participantId: participant.id,
      displayName: participant.display_name,
      text: p.text.trim(),
      sentAt: Date.now(),
    });
    d.messages = d.messages.slice(-50);
    save(room.id, d);
    publishCollaboration(room.id);
  });
  bind("vote-photo", (p) => {
    const { room, participant } = member(p);
    rate(`vote:${participant.id}`, 60);
    const d = document(room.id);
    assert(
      ["reviewing", "editing", "exporting"].includes(room.status) &&
        p.roundId === d.roundId,
      "Photo voting is unavailable for this round",
      409,
    );
    assert(
      Number.isInteger(p.frameIndex) &&
        p.frameIndex >= 0 &&
        p.frameIndex < d.frameCount &&
        captureQueries
          .metadataByRoom(room.id)
          .some(
            (c) => c.round_id === d.roundId && c.frame_index === p.frameIndex,
          ),
      "Unknown photo",
    );
    assert(typeof p.selected === "boolean", "Invalid vote");
    assert(
      p.position === undefined ||
        p.position === null ||
        (Number.isInteger(p.position) &&
          p.position >= 0 &&
          p.position < d.frameCount),
      "Invalid photo position",
    );
    d.photoVotes = d.photoVotes.filter(
      (v) =>
        !(v.participantId === participant.id && v.frameIndex === p.frameIndex),
    );
    if (p.selected)
      d.photoVotes.push({
        participantId: participant.id,
        frameIndex: p.frameIndex,
        position: p.position ?? null,
      });
    save(room.id, d);
    publishCollaboration(room.id);
  });
  bind("review-approval", (p) => {
    const { room, participant } = member(p);
    const d = document(room.id);
    assert(
      ["reviewing", "editing", "exporting"].includes(room.status) &&
        d.reviewRevision &&
        p.revision === d.reviewRevision,
      "The order changed. Check the latest strip before approving.",
      409,
    );
    assert(typeof p.approved === "boolean", "Invalid approval");
    const photos = d.editor.assignedPhotos;
    assert(
      Array.isArray(photos) &&
        photos.length === d.frameCount &&
        photos.every((photo) => typeof photo === "string" && photo.length > 0),
      "Fill every frame before approving",
      409,
    );
    d.reviewApprovals = d.reviewApprovals.filter((id) => id !== participant.id);
    if (p.approved) d.reviewApprovals.push(participant.id);
    save(room.id, d);
    publishCollaboration(room.id);
  });
  bind("capture-ready", (p) => {
    const { room, participant } = member(p);
    assert(typeof p.ready === "boolean", "ready must be boolean");
    const d = document(room.id);
    d.readyParticipantIds = d.readyParticipantIds.filter(
      (id) => id !== participant.id,
    );
    if (p.ready) d.readyParticipantIds.push(participant.id);
    else
      d.approvedParticipantIds = d.approvedParticipantIds.filter(
        (id) => id !== participant.id,
      );
    save(room.id, d);
    changed(room.id);
  });
  bind("prepare-retake", (p) => {
    const { room } = member(p, true),
      d = document(room.id);
    assert(
      ["reviewing", "editing", "exporting"].includes(room.status),
      "Finish the current shots before requesting a retake",
      409,
    );
    assert(p.roundId === d.roundId && d.roundId, "Stale capture round", 409);
    assert(
      Number.isInteger(p.frameIndex) &&
        p.frameIndex >= 0 &&
        p.frameIndex < d.frameCount,
      "Invalid retake frame",
    );
    assert(
      Array.isArray(p.slotIndexes) &&
        p.slotIndexes.length <= 12 &&
        p.slotIndexes.every(
          (i: unknown) =>
            Number.isInteger(i) && Number(i) >= 0 && Number(i) < d.frameCount,
        ),
      "Invalid retake assignments",
    );
    if (p.editor !== undefined) {
      const editor = editorDocument(p.editor);
      assert(
        JSON.stringify(editor).length <= 6000000,
        "Editor document too large",
        413,
      );
      d.editor = editor;
    }
    const photos = Array.isArray(d.editor.assignedPhotos)
      ? (d.editor.assignedPhotos as string[])
      : [];
    const sources = Array.isArray(d.editor.photoSources)
      ? [...(d.editor.photoSources as (number | null)[])]
      : Array(photos.length).fill(null);
    p.slotIndexes.forEach((i: number) => {
      photos[i] = "";
      sources[i] = p.frameIndex;
    });
    d.editor.assignedPhotos = photos;
    d.editor.photoSources = sources;
    d.retakeFrameIndex = p.frameIndex;
    d.readyParticipantIds = [];
    d.approvedParticipantIds = [];
    d.reviewApprovals = [];
    d.reviewRevision = "";
    d.shotDeadlines = [];
    d.stage = "capture";
    save(room.id, d);
    roomQueries.setStatus(room.id, "ready");
    changed(room.id);
    return { snapshot: snapshot(room.id) };
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
      assert(
        d.approvalRoster ===
          people
            .map((p) => p.id)
            .sort()
            .join(",") &&
          people.every((p) => d.approvedParticipantIds.includes(p.id)),
        "Every participant must approve starting the shots",
        409,
      );
      d.approvedParticipantIds = [];
      const n = p.frameCount ?? 4;
      assert(
        Number.isInteger(n) && n >= 1 && n <= 12,
        "frameCount must be 1–12",
      );
      if (d.retakeFrameIndex !== null)
        assert(
          n === d.frameCount,
          "A retake must keep the original shot count",
          409,
        );
      if (room.layout_id === "custom") {
        const shape = customLayout(d.editor.customLayout);
        assert(
          n === shape.frames.length,
          "Shot count must match your custom frames",
        );
      }
      d.photoVotes = [];
      d.reviewApprovals = [];
      d.reviewRevision = "";
      const previousRound = d.roundId;
      d.roundId = randomUUID();
      d.frameCount = n;
      d.shotDeadlines = Array.from({ length: n }, (_, i) =>
        d.retakeFrameIndex !== null
          ? i === d.retakeFrameIndex
            ? Date.now() + 1500 + Math.max(1, room.timer_seconds) * 1000
            : 0
          : Date.now() +
            1500 +
            (i + 1) * Math.max(1, room.timer_seconds) * 1000,
      );
      d.expectedParticipantIds = people.map((p) => p.id);
      if (d.retakeFrameIndex !== null) {
        assert(previousRound, "No photos to retake", 409);
        captureQueries.retakeRound(
          room.id,
          previousRound,
          d.roundId,
          d.retakeFrameIndex,
        );
      } else {
        d.editor = {
          ...keepsakeStyle(d.editor),
          ...(d.customDesign ? { designPreset: d.customDesign } : {}),
          layoutId: room.layout_id,
          customLayout: d.editor.customLayout ?? null,
        };
        captureQueries.deleteByRoom(room.id);
      }
      d.stage = "capture";
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
      d.retakeFrameIndex = null;
      d.reviewApprovals = [];
      d.reviewRevision = "";
      d.stage = "capture";
      d.roundId = null;
      d.shotDeadlines = [];
      d.photoVotes = [];
      d.readyParticipantIds = [];
      d.approvedParticipantIds = [];
      d.expectedParticipantIds = [];
      d.editor = {
        ...keepsakeStyle(d.editor),
        ...(d.customDesign ? { designPreset: d.customDesign } : {}),
        layoutId: room.layout_id,
        customLayout: d.editor.customLayout ?? null,
      };
      captureQueries.deleteByRoom(room.id);
    }
    if (p.status === "waiting") {
      d.retakeFrameIndex = null;
      d.reviewApprovals = [];
      d.reviewRevision = "";
      d.roundId = null;
      d.shotDeadlines = [];
      d.photoVotes = [];
      d.readyParticipantIds = [];
      d.approvedParticipantIds = [];
      d.expectedParticipantIds = [];
      d.editor = {
        layoutId: room.layout_id,
        customLayout: d.editor.customLayout ?? null,
      };
      d.stage = "editor";
      captureQueries.deleteByRoom(room.id);
    }
    if (p.status === "editing") {
      assert(
        d.reviewRevision &&
          participantQueries
            .findByRoom(room.id)
            .every((person) => d.reviewApprovals.includes(person.id)),
        "Everyone must approve this photo order first",
        409,
      );
      d.stage = "editor";
    }
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
    const d = document(room.id);
    d.approvedParticipantIds = [];
    save(room.id, d);
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
    if (p.layoutId === "custom")
      d.editor.customLayout = customLayout(p.customLayout);
    else d.editor.customLayout = null;
    if (p.keepsakeStyle !== undefined)
      Object.assign(d.editor, keepsakeStyle(editorDocument(p.keepsakeStyle)));
    d.editor.layoutId = p.layoutId;
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
    const orderChanged =
      JSON.stringify(d.editor.assignedPhotos ?? []) !==
        JSON.stringify(editor.assignedPhotos ?? []) ||
      d.editor.layoutId !== editor.layoutId ||
      JSON.stringify(d.editor.customLayout) !==
        JSON.stringify(editor.customLayout) ||
      JSON.stringify(d.editor.photoEdits ?? []) !==
        JSON.stringify(editor.photoEdits ?? []);
    if (
      (room.status === "reviewing" || d.stage === "editor") &&
      stage !== "editor"
    )
      assert(
        d.reviewRevision &&
          !orderChanged &&
          participantQueries
            .findByRoom(room.id)
            .every((person) => d.reviewApprovals.includes(person.id)),
        "Everyone must approve this photo order first",
        409,
      );
    if (orderChanged) {
      d.reviewRevision = randomUUID();
      d.reviewApprovals = [];
    }
    d.editor = editor;
    d.stage = stage;
    save(room.id, d);
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
  online.clear();
  changes.removeAllListeners("room");
}
