import test from "node:test";
import assert from "node:assert/strict";
import { normalizeRoomCode, isRoomCode } from "../src/lib/roomCode.ts";

test("pasted and invitation codes normalize without losing letters", () => {
  assert.equal(normalizeRoomCode("  aBcDe \n"), "ABCDE");
  assert.equal(isRoomCode("  aBcDe \n"), true);
  assert.equal(normalizeRoomCode("ABCDEF"), "ABCDEF");
});

test("invalid codes cannot become another room code through truncation", () => {
  for (const code of [
    "",
    "ABCD",
    "ABCDEF",
    "AB1DE",
    "AB/DE",
    "AB DE",
    "ＡＢＣＤＥ",
  ])
    assert.equal(isRoomCode(code), false, code);
});
