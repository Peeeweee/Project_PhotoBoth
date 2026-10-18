import test from "node:test";
import assert from "node:assert/strict";
import { File } from "node:buffer";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const exports = {};
const navigator = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync(
      new URL("../src/lib/deviceSupport.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText,
  { exports, Error, Math, File, Uint8Array, atob, navigator },
);
test("phone and desktop exports honor dimension and canvas-memory bounds", () => {
  for (const touch of [false, true])
    for (const [w, h] of [
      [1000, 1000],
      [1000, 8000],
      [2400, 1000],
    ]) {
      const ratio = exports.exportPixelRatio(w, h, touch);
      assert.ok(Math.max(w * ratio, h * ratio) <= (touch ? 2400 : 3200) + 0.01);
      assert.ok(w * h * ratio * ratio <= (touch ? 6000000 : 10000000) + 1);
    }
  assert.throws(() => exports.exportPixelRatio(0, 200));
});
test("prepared PNG/PDF files keep MIME and bytes for native mobile sharing", async () => {
  for (const type of ["image/png", "application/pdf"]) {
    const file = exports.dataUrlFile(
      `data:${type};filename=test;base64,aGVsbG8=`,
      "test.file",
    );
    assert.equal(file.type, type);
    assert.equal(file.name, "test.file");
    assert.equal(await file.text(), "hello");
  }
  assert.throws(() => exports.dataUrlFile("broken", "test"));
});
test("file sharing degrades safely when unsupported or rejected", () => {
  const file = new File(["hello"], "test.txt");
  assert.equal(exports.canShareFile(file), false);
  navigator.share = () => Promise.resolve();
  navigator.canShare = () => true;
  assert.equal(exports.canShareFile(file), true);
  navigator.canShare = () => {
    throw new Error("unsupported");
  };
  assert.equal(exports.canShareFile(file), false);
});
test("camera errors explain permission, missing hardware and busy-device recovery", () => {
  for (const [name, pattern] of [
    ["NotAllowedError", /site settings/],
    ["NotFoundError", /No camera/],
    ["NotReadableError", /busy/],
  ]) {
    const error = new Error("camera");
    error.name = name;
    assert.match(exports.cameraErrorMessage(error), pattern);
  }
});
