import Database, { type Database as DatabaseType } from "better-sqlite3";
import { readFileSync } from "fs";
import { join, resolve } from "path";
import type {
  RoomStatus,
  RoomRecord as Room,
  ParticipantRecord as Participant,
  CaptureRecord as Capture,
} from "../../shared/contracts";
export type {
  RoomStatus,
  RoomRecord as Room,
  ParticipantRecord as Participant,
  CaptureRecord as Capture,
} from "../../shared/contracts";
const db: DatabaseType = new Database(
  process.env.DB_PATH ?? resolve(__dirname, "..", "photodate.db"),
);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
// Schema is copied alongside compiled modules; startup does not depend on cwd.
db.exec(readFileSync(join(__dirname, "schema.sql"), "utf8"));
const version = db.pragma("user_version", { simple: true }) as number;
if (version < 1) {
  db.pragma("foreign_keys = OFF");
  try {
    db.transaction(() => {
      // Rebuild the original tables to upgrade even older two-slot databases.
      db.exec(`CREATE TABLE participants_v1 (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, display_name TEXT NOT NULL, slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 3), joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(room_id,slot_index), UNIQUE(id,room_id));
 INSERT INTO participants_v1 SELECT id,room_id,display_name,slot_index,joined_at FROM participants;
 CREATE TABLE captures_v1 (id TEXT PRIMARY KEY, room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE, participant_id TEXT NOT NULL, frame_index INTEGER NOT NULL CHECK(frame_index BETWEEN 0 AND 11), image_url TEXT NOT NULL, captured_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), round_id TEXT NOT NULL DEFAULT 'legacy', FOREIGN KEY(participant_id,room_id) REFERENCES participants(id,room_id) ON DELETE CASCADE, UNIQUE(room_id,round_id,participant_id,frame_index));
 INSERT INTO captures_v1(id,room_id,participant_id,frame_index,image_url,captured_at) SELECT c.id,c.room_id,c.participant_id,c.frame_index,c.image_url,c.captured_at FROM captures c JOIN participants p ON p.id=c.participant_id AND p.room_id=c.room_id WHERE c.frame_index BETWEEN 0 AND 11;
 DROP TABLE captures; DROP TABLE participants; ALTER TABLE participants_v1 RENAME TO participants; ALTER TABLE captures_v1 RENAME TO captures;
 CREATE INDEX idx_participants_room ON participants(room_id); CREATE INDEX idx_captures_room ON captures(room_id);
 CREATE TABLE sessions (token_hash TEXT PRIMARY KEY,participant_id TEXT NOT NULL REFERENCES participants(id) ON DELETE CASCADE,room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE);
 CREATE TABLE room_documents (room_id TEXT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE, document TEXT NOT NULL DEFAULT '{}');
 PRAGMA user_version=1;`);
    })();
  } finally {
    db.pragma("foreign_keys = ON");
  }
}
export const roomQueries = {
  create: (r: Omit<Room, "created_at">) =>
    db
      .prepare(
        "INSERT INTO rooms(id,code,host_id,theme_pack_id,layout_id,design_id,timer_seconds,status) VALUES(@id,@code,@host_id,@theme_pack_id,@layout_id,@design_id,@timer_seconds,@status)",
      )
      .run(r),
  findById: (id: string) =>
    db.prepare("SELECT * FROM rooms WHERE id=?").get(id) as Room | undefined,
  findByCode: (code: string) =>
    db.prepare("SELECT * FROM rooms WHERE code=?").get(code) as
      Room | undefined,
  setStatus: (id: string, s: RoomStatus) =>
    db.prepare("UPDATE rooms SET status=? WHERE id=?").run(s, id),
  setTimerSeconds: (id: string, n: number) =>
    db.prepare("UPDATE rooms SET timer_seconds=? WHERE id=?").run(n, id),
  setSelections: (
    id: string,
    o: {
      themePackId: string | null;
      layoutId: string | null;
      designId: string | null;
      timerSeconds: number;
    },
  ) =>
    db
      .prepare(
        "UPDATE rooms SET theme_pack_id=?,layout_id=?,design_id=?,timer_seconds=? WHERE id=?",
      )
      .run(o.themePackId, o.layoutId, o.designId, o.timerSeconds, id),
  delete: (id: string) => db.prepare("DELETE FROM rooms WHERE id=?").run(id),
};
export const participantQueries = {
  create: (p: Omit<Participant, "joined_at">) =>
    db
      .prepare(
        "INSERT INTO participants(id,room_id,display_name,slot_index) VALUES(@id,@room_id,@display_name,@slot_index)",
      )
      .run(p),
  findById: (id: string) =>
    db.prepare("SELECT * FROM participants WHERE id=?").get(id) as
      Participant | undefined,
  findByRoom: (id: string) =>
    db
      .prepare("SELECT * FROM participants WHERE room_id=? ORDER BY slot_index")
      .all(id) as Participant[],
  countInRoom: (id: string) =>
    (
      db
        .prepare("SELECT count(*) n FROM participants WHERE room_id=?")
        .get(id) as {
        n: number;
      }
    ).n,
  nextSlot: (id: string) => {
    const used = new Set(
      participantQueries.findByRoom(id).map((p) => p.slot_index),
    );
    return [0, 1, 2, 3].find((n) => !used.has(n as 0)) ?? null;
  },
  delete: (id: string) =>
    db.prepare("DELETE FROM participants WHERE id=?").run(id),
};
export const captureQueries = {
  create: (c: Omit<Capture, "captured_at">) =>
    db
      .prepare(
        "INSERT INTO captures(id,room_id,participant_id,frame_index,image_url,round_id) VALUES(@id,@room_id,@participant_id,@frame_index,@image_url,@round_id) ON CONFLICT(room_id,round_id,participant_id,frame_index) DO UPDATE SET image_url=excluded.image_url",
      )
      .run({ ...c, round_id: c.round_id ?? "legacy" }),
  findById: (id: string) =>
    db.prepare("SELECT * FROM captures WHERE id=?").get(id) as
      Capture | undefined,
  findByRoom: (id: string) =>
    db
      .prepare(
        "SELECT * FROM captures WHERE room_id=? ORDER BY frame_index,participant_id",
      )
      .all(id) as Capture[],
  deleteByRoom: (id: string) =>
    db.prepare("DELETE FROM captures WHERE room_id=?").run(id),
};
export default db;
