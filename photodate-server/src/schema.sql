PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── rooms ──────────────────────────────────────────────────────────────────
-- One row per photo-booth session.
CREATE TABLE IF NOT EXISTS rooms (
  id              TEXT    PRIMARY KEY,          -- UUID v4
  code            TEXT    NOT NULL UNIQUE,      -- 6-char human join code e.g. "AB12CD"
  host_id         TEXT    NOT NULL,             -- participant.id of the room creator
  theme_pack_id   TEXT,                         -- nullable until chosen
  layout_id       TEXT,                         -- nullable until chosen
  design_id       TEXT,                         -- nullable until chosen
  timer_seconds   INTEGER NOT NULL DEFAULT 3,   -- countdown before each shot
  status          TEXT    NOT NULL DEFAULT 'waiting'
                          CHECK (status IN (
                            'waiting', 'ready', 'capturing',
                            'reviewing', 'editing', 'exporting', 'closed'
                          )),
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── participants ───────────────────────────────────────────────────────────
-- Up to 2 participants per room (slot_index 0 = host, 1 = guest).
CREATE TABLE IF NOT EXISTS participants (
  id            TEXT    PRIMARY KEY,            -- UUID v4
  room_id       TEXT    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  display_name  TEXT    NOT NULL,
  slot_index    INTEGER NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
  joined_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (room_id, slot_index)                  -- only one person per slot
);

-- ── captures ──────────────────────────────────────────────────────────────
-- Individual raw frames captured during a session.
CREATE TABLE IF NOT EXISTS captures (
  id              TEXT    PRIMARY KEY,          -- UUID v4
  room_id         TEXT    NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  participant_id  TEXT    NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  frame_index     INTEGER NOT NULL,             -- 0-based position in the strip
  image_url       TEXT    NOT NULL,             -- stored path or cloud URL
  captured_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (room_id, frame_index)                 -- one frame per index per room
);

-- ── strips ─────────────────────────────────────────────────────────────────
-- The final composed photo strip for a room.
CREATE TABLE IF NOT EXISTS strips (
  id              TEXT    PRIMARY KEY,          -- UUID v4
  room_id         TEXT    NOT NULL UNIQUE REFERENCES rooms(id) ON DELETE CASCADE,
  title           TEXT    NOT NULL DEFAULT '',
  final_image_url TEXT,                         -- null until export complete
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_participants_room  ON participants(room_id);
CREATE INDEX IF NOT EXISTS idx_captures_room      ON captures(room_id);
CREATE INDEX IF NOT EXISTS idx_captures_frame     ON captures(room_id, frame_index);
