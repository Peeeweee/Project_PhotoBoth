import type {
  RoomSnapshot,
  RoomMessage,
  PhotoVote,
} from "../../shared/contracts";
import { createHash, randomBytes } from "crypto";
import { EventEmitter } from "events";
import db, {
  roomQueries,
  participantQueries,
  captureQueries,
  type Room,
} from "./db";
export const changes = new EventEmitter();
export const RETENTION_HOURS = Number(process.env.RETENTION_HOURS) || 24;
export class Fault extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assert(ok: unknown, message: string, status = 400): asserts ok {
  if (!ok) throw new Fault(status, message);
}
export const object = (x: unknown): Record<string, any> => {
  assert(x && typeof x === "object" && !Array.isArray(x), "Expected an object");
  return x as Record<string, any>;
};
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function issue(roomId: string, participantId: string) {
  const token = randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash(token),
    participantId,
    roomId,
  );
  reserveParticipant(participantId);
  return token;
}
export function roomByCode(code: unknown) {
  assert(
    typeof code === "string" && /^[A-Z]{5}$/.test(code.trim().toUpperCase()),
    "Invalid room code",
  );
  const room = roomQueries.findByCode(code.trim().toUpperCase());
  assert(room, "Room not found", 404);
  assert(
    Date.parse(room.created_at) + RETENTION_HOURS * 3600000 > Date.now(),
    "Room expired",
    410,
  );
  assert(room.status !== "closed", "Room closed", 410);
  return room;
}
export function authenticate(room: Room, token: unknown) {
  assert(
    typeof token === "string" && token.length < 200,
    "Session credential required",
    401,
  );
  const row = db
    .prepare(
      "SELECT participant_id FROM sessions WHERE token_hash=? AND room_id=?",
    )
    .get(hash(token), room.id) as
    | {
        participant_id: string;
      }
    | undefined;
  assert(row, "Invalid session credential", 401);
  const p = participantQueries.findById(row.participant_id);
  assert(p && p.room_id === room.id, "Membership revoked", 401);
  return p;
}
export interface Document {
  version: number;
  editor: Record<string, unknown>;
  stage: string;
  roundId: string | null;
  frameCount: number;
  messages: RoomMessage[];
  photoVotes: PhotoVote[];
  shotDeadlines: number[];
  readyParticipantIds: string[];
  approvedParticipantIds: string[];
  approvalRoster: string;
  expectedParticipantIds: string[];
  customDesign?: unknown;
}
export function document(roomId: string): Document {
  const row = db
    .prepare("SELECT document FROM room_documents WHERE room_id=?")
    .get(roomId) as
    | {
        document: string;
      }
    | undefined;
  return {
    version: 0,
    editor: {},
    stage: "editor",
    roundId: null,
    frameCount: 4,
    messages: [],
    photoVotes: [],
    shotDeadlines: [],
    readyParticipantIds: [],
    approvedParticipantIds: [],
    approvalRoster: "",
    expectedParticipantIds: [],
    ...(row ? JSON.parse(row.document) : {}),
  };
}
export function save(roomId: string, d: Document) {
  d.version++;
  db.prepare(
    "INSERT INTO room_documents VALUES(?,?) ON CONFLICT(room_id) DO UPDATE SET document=excluded.document",
  ).run(roomId, JSON.stringify(d));
}
export const online = new Map<string, Set<string>>();
export function snapshot(roomId: string, includeCaptures = true): RoomSnapshot {
  const d = document(roomId);
  const room = roomQueries.findById(roomId);
  assert(room, "Room not found", 404);
  return {
    room,
    participants: participantQueries
      .findByRoom(roomId)
      .map((p) => ({ ...p, online: !!online.get(p.id)?.size })),
    captures: includeCaptures ? captureQueries.findByRoom(roomId) : undefined,
    ...d,
    approvedParticipantIds:
      d.approvalRoster ===
      participantQueries
        .findByRoom(roomId)
        .map((p) => p.id)
        .sort()
        .join(",")
        ? d.approvedParticipantIds
        : [],
    serverTime: Date.now(),
  };
}
export function changed(roomId: string) {
  changes.emit("room", roomId);
}
export function complete(roomId: string) {
  const d = document(roomId);
  const room = roomQueries.findById(roomId);
  if (room?.status !== "capturing") return;
  const rows = captureQueries
    .metadataByRoom(roomId)
    .filter((c) => c.round_id === d.roundId);
  if (
    d.expectedParticipantIds.length &&
    d.expectedParticipantIds.every(
      (id) =>
        rows.filter((c) => c.participant_id === id).length === d.frameCount,
    )
  ) {
    roomQueries.setStatus(roomId, "reviewing");
    d.stage = "editor";
    save(roomId, d);
  }
  changed(roomId);
}
export function validateImage(value: unknown, maxBytes = 2 * 1024 * 1024) {
  assert(
    typeof value === "string" &&
      value.length < Math.ceil((maxBytes * 4) / 3) + 100,
    "Image exceeds size limit",
    413,
  );
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    value,
  );
  assert(m, "Expected a PNG or JPEG data URL");
  const b = Buffer.from(m[2], "base64");
  assert(
    b.length <= maxBytes && b.length > 24 && b.toString("base64") === m[2],
    "Invalid image",
  );
  let width = 0,
    height = 0;
  if (m[1] === "png") {
    assert(
      b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        b.toString("ascii", 12, 16) === "IHDR",
      "Invalid PNG",
    );
    width = b.readUInt32BE(16);
    height = b.readUInt32BE(20);
    assert(b.includes(Buffer.from("IEND")), "Incomplete PNG");
  } else {
    assert(
      b[0] === 255 &&
        b[1] === 216 &&
        b[b.length - 2] === 255 &&
        b[b.length - 1] === 217,
      "Invalid JPEG",
    );
    let pos = 2;
    while (pos + 4 < b.length) {
      if (b[pos++] !== 255) break;
      const marker = b[pos++];
      const len = b.readUInt16BE(pos);
      if ([192, 193, 194].includes(marker)) {
        assert(pos + 7 <= b.length, "Truncated JPEG");
        height = b.readUInt16BE(pos + 3);
        width = b.readUInt16BE(pos + 5);
        break;
      }
      if (len < 2) break;
      pos += len;
    }
  }
  assert(
    width > 0 &&
      height > 0 &&
      width <= 4096 &&
      height <= 4096 &&
      width * height <= 12000000,
    "Invalid or oversized image dimensions",
  );
  return value;
}
let lastCleanup = 0;
export function cleanup(force = true) {
  if (!force && Date.now() - lastCleanup < 60000) return;
  lastCleanup = Date.now();
  const expired = db
    .prepare(
      "SELECT id,host_id FROM rooms WHERE julianday(created_at)<julianday('now',?)",
    )
    .all(`-${RETENTION_HOURS} hours`) as { id: string; host_id: string }[];
  for (const room of expired) {
    // Notify and evict connected participants before cascading away the room.
    removeParticipant(room.id, room.host_id);
    roomQueries.delete(room.id);
  }
}

const buckets = new Map<
  string,
  {
    count: number;
    until: number;
  }
>();
export function rate(key: string, limit = 120) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.until < now) {
    b = { count: 0, until: now + 60000 };
    buckets.set(key, b);
  }
  assert(++b.count <= limit, "Too many requests; retry in a minute", 429);
  if (buckets.size > 10000)
    for (const [k, v] of buckets) if (v.until < now) buckets.delete(k);
}
export const layouts = [
  "landscape-2",
  "landscape-3",
  "portrait-4",
  "group-wide",
  "2x1",
  "2x2",
  "3x1",
  "4x1",
  "6x1",
  "3x2",
  "wide-1",
  "collage",
];
export const designs = [
  "solid-white",
  "solid-black",
  "solid-gray",
  "solid-pink",
  "solid-blue",
  "solid-yellow",
  "solid-sage",
  "pat-grid",
  "pat-dots",
  "pat-checker",
  "pat-stripes",
  "pat-blue-waves",
  "pat-retro",
  "pat-stars",
  "pat-terrazzo",
  "pat-haze",
  "pat-vintage",
  "pat-glitch",
];
function text(v: unknown, max = 100) {
  assert(typeof v === "string" && v.length <= max, "Invalid text");
  return v;
}
function num(v: unknown, min = -10000, max = 10000) {
  assert(
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max,
    "Invalid coordinate",
  );
  return v;
}
function css(v: unknown, max = 1000) {
  const s = text(v, max);
  assert(
    !/[<>;{}]|expression|@import|javascript:|https?:|blob:/i.test(s),
    "Unsafe design style",
  );
  return s;
}
function patternCss(value: unknown) {
  const s = text(value, 2000);
  if (!s.includes(":")) {
    assert(!/url\s*\(|[\\]/i.test(s), "Unsafe design filter");
    return css(s);
  }
  const declarations = s
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
  assert(declarations.length <= 5, "Too many pattern declarations");
  return declarations
    .map((item) => {
      const colon = item.indexOf(":");
      const name = item.slice(0, colon).trim();
      const value = item.slice(colon + 1).trim();
      assert(
        ["background-image", "background-size", "background-position"].includes(
          name,
        ),
        "Unsupported pattern property",
      );
      assert(!/url\s*\(|[\\]/i.test(value), "Unsafe pattern URL");
      css(value, 1500);
      return name + ": " + value + ";";
    })
    .join(" ");
}
export function design(value: unknown) {
  const d = object(value);
  assert(
    typeof d.id === "string" && /^[\w-]{1,100}$/.test(d.id),
    "Invalid design id",
  );
  assert(
    d.edgeStyle === undefined ||
      ["square", "rounded", "arch", "ticket", "postage"].includes(d.edgeStyle),
    "Unknown frame edge",
  );
  const background = text(d.background, 3000000);
  if (/url\(/i.test(background)) {
    const m =
      /^url\(["']?(data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/]+=*)["']?\)(?: center \/ cover no-repeat, #fff)?$/.exec(
        background,
      );
    assert(m, "Only inline PNG/JPEG backgrounds are accepted");
    validateImage(m[1]);
  } else css(background);
  return {
    id: d.id,
    name: text(d.name, 100),
    background,
    ...(d.edgeStyle !== undefined ? { edgeStyle: d.edgeStyle } : {}),
    ...(d.filterCss !== undefined
      ? { filterCss: patternCss(d.filterCss) }
      : {}),
    ...(d.borderStyle !== undefined ? { borderStyle: css(d.borderStyle) } : {}),
  };
}
export function editorDocument(value: unknown) {
  const e = object(value),
    out: Record<string, unknown> = {};
  const allowed = [
    "assignedPhotos",
    "placedStickers",
    "drawStrokes",
    "stripTitle",
    "titlePosition",
    "filterId",
    "showWatermark",
    "designPreset",
    "layoutId",
    "title",
  ];
  assert(
    Object.keys(e).every((k) => allowed.includes(k)),
    "Unknown editor field",
  );
  if (e.assignedPhotos !== undefined) {
    assert(
      Array.isArray(e.assignedPhotos) && e.assignedPhotos.length <= 12,
      "Too many photos",
    );
    out.assignedPhotos = e.assignedPhotos.map((p: unknown) =>
      p === "" ? "" : validateImage(p),
    );
  }
  if (e.designPreset !== undefined)
    out.designPreset = e.designPreset === null ? null : design(e.designPreset);
  if (e.layoutId !== undefined) {
    assert(layouts.includes(e.layoutId), "Unknown layout");
    out.layoutId = e.layoutId;
  }
  if (e.filterId !== undefined) {
    assert(
      [
        "original",
        "mono",
        "retro",
        "film",
        "cool",
        "peach",
        "automat",
      ].includes(e.filterId),
      "Unknown filter",
    );
    out.filterId = e.filterId;
  }
  if (e.titlePosition !== undefined) {
    const position = object(e.titlePosition);
    assert(
      [position.x, position.y].every(
        (v) => typeof v === "number" && Number.isFinite(v) && v >= 5 && v <= 99,
      ),
      "Title position must be between 5 and 99 percent",
    );
    assert(
      position.auto === undefined || typeof position.auto === "boolean",
      "Invalid automatic title placement",
    );
    out.titlePosition = {
      x: position.x,
      y: position.y,
      ...(position.auto !== undefined ? { auto: position.auto } : {}),
    };
  }
  if (e.stripTitle !== undefined) {
    assert(
      typeof e.stripTitle === "string" && e.stripTitle.length <= 200,
      "Title must be at most 200 characters",
    );
    out.stripTitle = e.stripTitle;
  }
  if (e.title !== undefined) out.title = text(e.title, 200);
  if (e.showWatermark !== undefined) {
    assert(typeof e.showWatermark === "boolean", "Invalid watermark flag");
    out.showWatermark = e.showWatermark;
  }
  if (e.placedStickers !== undefined) {
    assert(
      Array.isArray(e.placedStickers) && e.placedStickers.length <= 100,
      "Too many stickers",
    );
    out.placedStickers = e.placedStickers.map((v: unknown) => {
      const s = object(v);
      return {
        id: text(s.id),
        stickerId: text(s.stickerId),
        x: num(s.x),
        y: num(s.y),
        scale: num(s.scale, 0.01, 20),
        rotation: num(s.rotation, -36000, 36000),
      };
    });
  }
  if (e.drawStrokes !== undefined) {
    assert(
      Array.isArray(e.drawStrokes) && e.drawStrokes.length <= 300,
      "Too many strokes",
    );
    out.drawStrokes = e.drawStrokes.map((v: unknown) => {
      const s = object(v);
      assert(
        Array.isArray(s.points) && s.points.length <= 10000,
        "Too many drawing points",
      );
      return {
        id: text(s.id),
        color: css(s.color, 50),
        thickness: num(s.thickness, 0.1, 100),
        points: s.points.map((v: unknown) => {
          const p = object(v);
          return { x: num(p.x), y: num(p.y) };
        }),
      };
    });
  }
  assert(
    JSON.stringify(out).length <= 6000000,
    "Editor document too large",
    413,
  );
  return out;
}
export function storageQuota(roomId: string, additional: number) {
  const row = db
    .prepare("SELECT bytes n FROM capture_storage WHERE scope=?")
    .get(roomId) as {
    n: number;
  };
  assert(
    (row?.n ?? 0) + additional <= 64 * 1024 * 1024,
    "Room photo quota reached",
    413,
  );
  const total = db
    .prepare("SELECT bytes n FROM capture_storage WHERE scope='*'")
    .get() as {
    n: number;
  };
  assert(
    total.n + additional <= 512 * 1024 * 1024,
    "Server photo quota reached",
    503,
  );
}

/** A REST reservation and a disconnected member have the same bounded lease. */
export const RECONNECT_GRACE_MS = Math.max(
  100,
  Number(process.env.RECONNECT_GRACE_MS) || 120000,
);
export function reserveParticipant(participantId: string) {
  db.prepare(
    "INSERT INTO participant_leases(participant_id,expires_at) VALUES(?,?) ON CONFLICT(participant_id) DO UPDATE SET expires_at=excluded.expires_at",
  ).run(participantId, Date.now() + RECONNECT_GRACE_MS);
}
export function markParticipantConnected(participantId: string) {
  db.prepare(
    "INSERT INTO participant_leases(participant_id,expires_at) VALUES(?,NULL) ON CONFLICT(participant_id) DO UPDATE SET expires_at=NULL",
  ).run(participantId);
}
export function removeParticipant(roomId: string, participantId: string) {
  const room = roomQueries.findById(roomId);
  if (!room) return;
  db.transaction(() => {
    if (room.host_id === participantId) {
      roomQueries.setStatus(roomId, "closed");
      for (const member of participantQueries.findByRoom(roomId))
        online.delete(member.id);
      db.prepare(
        "DELETE FROM participant_leases WHERE participant_id IN (SELECT id FROM participants WHERE room_id=?)",
      ).run(roomId);
    } else participantQueries.delete(participantId);
    const d = document(roomId);
    d.photoVotes = d.photoVotes.filter(
      (v) => v.participantId !== participantId,
    );
    d.readyParticipantIds = d.readyParticipantIds.filter(
      (id) => id !== participantId,
    );
    d.expectedParticipantIds = d.expectedParticipantIds.filter(
      (id) => id !== participantId,
    );
    save(roomId, d);
  }).immediate();
  online.delete(participantId);
  complete(roomId);
  changed(roomId);
}
export function reclaimExpiredParticipants(now = Date.now()) {
  const expired = db
    .prepare(
      "SELECT p.id,p.room_id FROM participant_leases l JOIN participants p ON p.id=l.participant_id JOIN rooms r ON r.id=p.room_id WHERE l.expires_at IS NOT NULL AND l.expires_at<=? AND r.status<>'closed'",
    )
    .all(now) as { id: string; room_id: string }[];
  for (const p of expired)
    if (!online.get(p.id)?.size) removeParticipant(p.room_id, p.id);
}
/** Run once on boot: clients may resume with the same credentials during grace. */
export function recoverPresence() {
  online.clear();
  db.transaction(() => {
    db.prepare(
      "INSERT OR IGNORE INTO participant_leases(participant_id,expires_at) SELECT p.id,NULL FROM participants p JOIN rooms r ON r.id=p.room_id WHERE r.status<>'closed'",
    ).run();
    db.prepare(
      "UPDATE participant_leases SET expires_at=? WHERE expires_at IS NULL",
    ).run(Date.now() + RECONNECT_GRACE_MS);
    const rooms = db
      .prepare("SELECT id,status FROM rooms WHERE status<>'closed'")
      .all() as { id: string; status: string }[];
    for (const room of rooms) {
      const d = document(room.id);
      d.readyParticipantIds = [];
      d.approvedParticipantIds = [];
      if (room.status === "capturing") {
        roomQueries.setStatus(room.id, "ready");
        d.stage = "capture";
        d.roundId = null;
        d.expectedParticipantIds = [];
        d.shotDeadlines = [];
        captureQueries.deleteByRoom(room.id);
      }
      save(room.id, d);
    }
  }).immediate();
  reclaimExpiredParticipants();
}
