import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
function source(file) {
  return ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
}
test("scheduled camera callbacks retain their original frame and fire at most once", () => {
  const refs = [],
    effects = [],
    timers = [];
  let cursor = 0,
    stateCursor = 0;
  const captured = [];
  const exports = {};
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ translate() {}, scale() {}, drawImage() {} }),
    toDataURL: () => "photo",
  };
  vm.runInNewContext(source("../src/components/capture/CameraView.tsx"), {
    exports,
    Math,
    Date,
    Set,
    document: { createElement: () => canvas },
    window: {
      setInterval: () => 1,
      clearInterval() {},
      setTimeout: (fn) => {
        timers.push(fn);
        return timers.length;
      },
      clearTimeout() {},
    },
    require: (name) =>
      name === "react"
        ? {
            useRef: (value) =>
              refs[cursor++] ?? (refs[cursor - 1] = { current: value }),
            useState: (value) => [stateCursor++ === 0 ? true : value, () => {}],
            useEffect: (fn) => effects.push(fn),
          }
        : {
            jsx: (type, props) => ({ type, props }),
            jsxs: (type, props) => ({ type, props }),
          },
  });
  const render = (frame) => {
    cursor = 0;
    stateCursor = 0;
    effects.length = 0;
    exports.default({
      isCountingDown: true,
      timerSeconds: 3,
      shotDeadline: Date.now(),
      frameIndex: frame,
      roundId: "round",
      captureAspectRatio: 0.75,
      onCapture: (data, index, round) => captured.push({ index, round }),
    });
  };
  render(0);
  refs[1].current = { readyState: 4, videoWidth: 1280, videoHeight: 720 };
  effects[1]();
  render(1); // A newer render updates callback refs while the earlier timer is still queued.
  timers[0]();
  timers[0]();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].index, 0);
  assert.equal(captured[0].round, "round");
  assert.equal(canvas.width / canvas.height, 0.75);
});
test("group composition fits the selected frame without cropping any participant image", async () => {
  const draws = [],
    exports = {};
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillRect() {},
      drawImage: (...args) => draws.push(args),
    }),
    toDataURL: () => "composed",
  };
  class Image {
    width = 640;
    height = 1280;
    set src(value) {
      this.onload();
    }
  }
  vm.runInNewContext(source("../src/lib/composeCaptures.ts"), {
    exports,
    Image,
    Math,
    Set,
    Promise,
    document: { createElement: () => canvas },
    require: (name) =>
      name.includes("stripLayouts")
        ? { getLayout: () => ({ frameAspectRatio: 1 }) }
        : name.includes("useSessionStore")
          ? { useSessionStore: { getState: () => ({ layoutId: "collage" }) } }
          : {
              useRoomStore: {
                getState: () => ({
                  participants: [
                    { id: "a", slot_index: 0 },
                    { id: "b", slot_index: 1 },
                  ],
                }),
              },
            },
  });
  await exports.composeCaptures([
    { id: "a", participant_id: "a", frame_index: 0, image_url: "one" },
    { id: "b", participant_id: "b", frame_index: 0, image_url: "two" },
  ]);
  assert.equal(canvas.width, canvas.height);
  assert.equal(draws.length, 2);
  for (const args of draws) {
    assert.equal(args.length, 5);
    assert.equal(args[3], 600);
    assert.equal(args[4], 1200);
  }
});
test("crew photo order respects suggested positions and keeps every chosen photo unique", () => {
  const exports = {};
  vm.runInNewContext(source("../src/lib/photoOrder.ts"), { exports });
  const order = exports.suggestedPhotoOrder(
    [{ frame_index: 0 }, { frame_index: 1 }, { frame_index: 2 }],
    [
      { participantId: "a", frameIndex: 2, position: 0 },
      { participantId: "b", frameIndex: 2, position: 0 },
      { participantId: "a", frameIndex: 0, position: 1 },
    ],
    3,
  );
  assert.equal(JSON.stringify(order.map((p) => p.frame_index)), "[2,0,1]");
});
