import { Router } from "express";
import { randomUUID, randomInt } from "crypto";
import db, { roomQueries, participantQueries, captureQueries } from "../db";
import {
  assert,
  object,
  issue,
  roomByCode,
  authenticate,
  snapshot,
  document,
  save,
  changed,
  complete,
  validateImage,
  cleanup,
  rate,
  storageQuota,
  reclaimExpiredParticipants,
  removeParticipant,
} from "../runtime";
const router = Router();
router.use((req, res, next) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    cleanup(false);
    reclaimExpiredParticipants();
    next();
  } catch (e) {
    next(e);
  }
});
const credential = (req: any) =>
  req.get("Authorization")?.replace(/^Bearer /, "");
router.post("/", (req, res) => {
  const b = object(req.body);
  assert(
    typeof b.hostName === "string" &&
      b.hostName.trim() &&
      b.hostName.length <= 32,
    "Name must contain 1–32 characters",
  );
  rate(`create:${req.ip}`, 30);
  const result = db
    .transaction(() => {
      assert(
        (
          db.prepare("SELECT count(*) n FROM rooms").get() as {
            n: number;
          }
        ).n < 1000,
        "Server room capacity reached",
        503,
      );
      const id = randomUUID(),
        hostId = randomUUID();
      let code = "";
      do {
        code = Array.from({ length: 5 }, () =>
          String.fromCharCode(65 + randomInt(26)),
        ).join("");
      } while (roomQueries.findByCode(code));
      roomQueries.create({
        id,
        code,
        host_id: hostId,
        theme_pack_id: null,
        layout_id: null,
        design_id: null,
        timer_seconds: 3,
        status: "waiting",
      });
      participantQueries.create({
        id: hostId,
        room_id: id,
        display_name: b.hostName.trim(),
        slot_index: 0,
      });
      return {
        roomId: id,
        code,
        hostId,
        sessionToken: issue(id, hostId),
        snapshot: snapshot(id),
      };
    })
    .immediate();
  res.status(201).json({ status: "ok", ...result });
});
router.get("/:code", (req, res) => {
  const room = roomByCode(req.params.code);
  authenticate(room, credential(req));
  const state = snapshot(room.id);
  res.json({ status: "ok", ...state, snapshot: state });
});
router.post("/:code/join", (req, res) => {
  const body = object(req.body),
    token = credential(req);
  const result = db
    .transaction(() => {
      const room = roomByCode(req.params.code);
      if (token) {
        const member = authenticate(room, token);
        return {
          existing: true,
          participantId: member.id,
          slotIndex: member.slot_index,
          sessionToken: token,
          room,
          snapshot: snapshot(room.id),
        };
      }
      assert(
        typeof body.displayName === "string" &&
          body.displayName.trim() &&
          body.displayName.length <= 32,
        "Name must contain 1–32 characters",
      );
      assert(
        ["waiting", "ready"].includes(room.status),
        "Session has already started",
        409,
      );
      const slot = participantQueries.nextSlot(room.id);
      assert(slot !== null, "Room is full", 409);
      const id = randomUUID();
      participantQueries.create({
        id,
        room_id: room.id,
        display_name: body.displayName.trim(),
        slot_index: slot as 0,
      });
      return {
        existing: false,
        participantId: id,
        slotIndex: slot,
        sessionToken: issue(room.id, id),
        room: roomQueries.findById(room.id)!,
        snapshot: snapshot(room.id),
      };
    })
    .immediate();
  changed(result.room.id);
  res.status(result.existing ? 200 : 201).json({ status: "ok", ...result });
});
router.post("/:code/captures", (req, res) => {
  const room = roomByCode(req.params.code),
    p = authenticate(room, credential(req)),
    b = object(req.body),
    d = document(room.id);
  assert(
    !b.participantId || b.participantId === p.id,
    "Wrong participant",
    403,
  );
  assert(
    room.status === "capturing" || room.status === "reviewing",
    "Room is not capturing",
    409,
  );
  assert(b.roundId === d.roundId && d.roundId, "Stale capture round", 409);
  assert(
    d.expectedParticipantIds.includes(p.id),
    "Participant is not in this round",
    403,
  );
  assert(
    Number.isInteger(b.frameIndex) &&
      b.frameIndex >= 0 &&
      b.frameIndex < d.frameCount,
    "Invalid frame index",
  );
  assert(
    Date.now() + 250 >= d.shotDeadlines[b.frameIndex],
    "Shot deadline has not arrived",
    409,
  );
  const image = validateImage(b.dataUrl);
  const existingLength = captureQueries.imageLength(
    room.id,
    d.roundId!,
    p.id,
    b.frameIndex,
  );
  storageQuota(room.id, image.length - existingLength);
  captureQueries.create({
    id: randomUUID(),
    room_id: room.id,
    participant_id: p.id,
    round_id: d.roundId,
    frame_index: b.frameIndex,
    image_url: image,
  });
  complete(room.id);
  res.status(201).json({ status: "ok", roundId: d.roundId });
});
router.get("/:code/captures", (req, res) => {
  const room = roomByCode(req.params.code);
  authenticate(room, credential(req));
  res.json({
    status: "ok",
    captures: captureQueries.findByRoom(room.id),
    roundId: document(room.id).roundId,
  });
});
router.post("/:code/leave", (req, res) => {
  const room = roomByCode(req.params.code),
    p = authenticate(room, credential(req));
  removeParticipant(room.id, p.id);
  res.json({ status: "ok" });
});
export default router;
