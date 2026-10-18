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

test("shooting mode retains the camera position and framing while hiding camera switching", () => {
  const CameraView = () => null;
  const jsx = (type, props) => ({ type, props });
  const room = {
    roomCode: "ABCDE",
    selfId: "host",
    isHost: true,
    status: "ready",
    participants: [{ id: "host", display_name: "Host", online: true }],
    roundId: "round",
    shotDeadlines: [100, 200, 300, 400],
    readyParticipantIds: ["host"],
    approvedParticipantIds: ["host"],
    connectionStatus: "joined",
    captureResumeVersion: 0,
  };
  const session = {
    timerMode: 3,
    shotCount: 4,
    layoutId: "4x1",
    designPreset: null,
    stripTitle: "Photo date",
    customLayout: null,
  };
  const exports = {};
  vm.runInNewContext(source("../src/pages/CaptureRoom.tsx"), {
    exports,
    require: (name) => {
      if (name === "react")
        return {
          useState: (value) => [
            typeof value === "function" ? value() : value,
            () => {},
          ],
          useEffect() {},
          useRef: (value) => ({ current: value }),
          useCallback: (fn) => fn,
        };
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (name.includes("useRoomStore")) return { useRoomStore: () => room };
      if (name.includes("useSessionStore"))
        return {
          useSessionStore: (selector) =>
            selector ? selector(session) : session,
        };
      if (name.includes("stripLayouts"))
        return {
          getLayout: () => ({
            stripAspectRatio: 0.5,
            slotCount: 4,
            name: "Classic",
            mixed: false,
          }),
          slotAspectRatio: () => 4 / 3,
        };
      if (name === "../components/capture") return { CameraView };
      return {};
    },
  });
  const cameras = (root) => {
    const found = [];
    const walk = (node, path) => {
      if (!node || typeof node !== "object") return;
      if (node.type === CameraView) found.push({ path, props: node.props });
      const children = node.props?.children;
      (Array.isArray(children) ? children : [children]).forEach((child, i) =>
        walk(child, path + "/" + i),
      );
    };
    walk(root, "root");
    return found;
  };
  const setup = exports.default();
  room.status = "capturing";
  const shooting = exports.default();
  const before = cameras(setup),
    after = cameras(shooting);
  assert.equal(before.length, 1);
  assert.equal(after.length, 1);
  assert.equal(before[0].path, after[0].path);
  assert.equal(after[0].props.allowCameraSwitch, false);
  assert.equal(
    before[0].props.captureAspectRatio,
    after[0].props.captureAspectRatio,
  );
  assert.ok(shooting.props.className.includes("is-shooting"));
});
test("continuous reel advances, adopts manual scrolling, reverses at edges and resumes without jumps", () => {
  const exports = {};
  const queue = new Map();
  let id = 0,
    paused = false;
  vm.runInNewContext(source("../src/lib/reelAutoplay.ts"), {
    exports,
    window: {
      requestAnimationFrame(callback) {
        queue.set(++id, callback);
        return id;
      },
      cancelAnimationFrame(key) {
        queue.delete(key);
      },
    },
  });
  const node = { scrollWidth: 1000, clientWidth: 300, scrollLeft: 0 };
  const stop = exports.beginReelAutoplay(node, () => paused);
  const tick = (time) => {
    const [key, callback] = queue.entries().next().value;
    queue.delete(key);
    callback(time);
  };
  tick(0);
  tick(16);
  assert.ok(node.scrollLeft > 0 && node.scrollLeft < 1);
  tick(32);
  assert.ok(node.scrollLeft > 1);
  paused = true;
  const before = node.scrollLeft;
  tick(5000);
  assert.equal(node.scrollLeft, before);
  paused = false;
  tick(5016);
  assert.ok(node.scrollLeft > before && node.scrollLeft - before < 1);
  node.scrollLeft = 350;
  tick(5032);
  assert.ok(node.scrollLeft > 350 && node.scrollLeft < 351);
  node.scrollLeft = 700;
  tick(5048);
  assert.ok(node.scrollLeft < 700 && node.scrollLeft > 699);
  tick(5064);
  assert.ok(node.scrollLeft < 699);
  stop();
  assert.equal(queue.size, 0);
});

test("ambient motion keeps its phase across room updates and joins the shared clock on navigation", () => {
  const timing = {};
  vm.runInNewContext(source("../src/lib/brandMotion.ts"), {
    exports: timing,
    Math,
  });
  const exports = {};
  let now = 5000,
    cached,
    reduced = false;
  vm.runInNewContext(source("../src/components/MotionScene.tsx"), {
    exports,
    Array,
    Date: { now: () => now },
    require: (name) =>
      name === "react"
        ? { useState: (init) => [(cached ??= init()), () => {}] }
        : name === "framer-motion"
          ? { motion: { div: "motion.div" }, useReducedMotion: () => reduced }
          : name.includes("brandMotion")
            ? timing
            : {
                jsx: (type, props) => ({ type, props }),
                jsxs: (type, props) => ({ type, props }),
              },
  });
  const first = exports.default({ name: "palette", start: 1000 });
  assert.equal(first.props.style["--scene-phase"], "-4s");
  now = 9000;
  assert.equal(
    exports.default({ name: "palette", start: 1000 }).props.style[
      "--scene-phase"
    ],
    "-4s",
  );
  cached = undefined; // a new route mounts its own choreography
  const next = exports.default({ name: "prism", start: 1000 });
  assert.equal(next.props.style["--scene-phase"], "-8s");
  reduced = true;
  assert.equal(
    exports.default({ name: "prism", start: 1000 }).props.transition.duration,
    0,
  );
});
test("shared Back navigation keeps lobby membership, protects active shots and synchronizes host steps", () => {
  function scenario(pathname, overrides = {}) {
    const navigated = [],
      emitted = [],
      stages = [];
    const room = {
      roomCode: "ABCDE",
      isHost: true,
      status: "ready",
      connectionStatus: "joined",
      ...overrides,
    };
    const design = { id: "solid-white", edgeStyle: "ticket" };
    const exports = {};
    vm.runInNewContext(source("../src/components/layout/BackButton.tsx"), {
      exports,
      window: { confirm: () => false },
      require: (name) => {
        if (name === "react")
          return { useState: (initial) => [initial, () => {}] };
        if (name === "react-router-dom")
          return {
            useLocation: () => ({ pathname }),
            useNavigate: () => (path) => navigated.push(path),
          };
        if (name.includes("useRoomStore"))
          return {
            useRoomStore: Object.assign(() => room, { getState: () => room }),
          };
        if (name.includes("useSessionStore"))
          return {
            useSessionStore: {
              getState: () => ({
                designPreset: design,
                setDesignPreset: () => {},
              }),
            },
          };
        if (name.includes("socket"))
          return {
            socket: {
              timeout: () => ({
                emit: (event, payload, ack) => {
                  emitted.push({ event, payload });
                  ack(null, { ok: true });
                },
              }),
            },
          };
        if (name.includes("session"))
          return {
            publishStage: (stage, done) => {
              stages.push(stage);
              done();
            },
          };
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
        };
      },
    });
    const button = exports.default().props.children[0];
    return { button, navigated, emitted, stages };
  }
  const lobby = scenario("/lobby");
  lobby.button.props.onClick();
  assert.equal(lobby.navigated[0], "/");
  assert.equal(lobby.emitted.length, 0);
  const capture = scenario("/capture");
  capture.button.props.onClick();
  assert.equal(capture.emitted[0].payload.status, "waiting");
  assert.equal(capture.navigated[0], "/layout");
  assert.equal(
    scenario("/capture", { status: "capturing" }).button.props.disabled,
    true,
  );
  const guest = scenario("/filter", { isHost: false, status: "editing" });
  guest.button.props.onClick();
  assert.equal(guest.stages.length, 0);
  assert.equal(guest.emitted.length, 0);
  assert.equal(guest.navigated[0], "/");
  const host = scenario("/filter", { status: "editing" });
  host.button.props.onClick();
  assert.equal(host.stages[0], "editor");
  assert.equal(host.navigated[0], "/editor");
  const review = scenario("/editor", { status: "reviewing" });
  review.button.props.onClick();
  assert.equal(review.emitted.length, 0); // Opening the card preserves photos until confirmed.
});

test("return-to-setup card preserves photos on cancel, reports failure and rejects stale rounds", () => {
  const exports = {},
    sent = [],
    updates = [];
  let closed = 0,
    returned = 0;
  const room = {
    roomCode: "ABCDE",
    roundId: "round-a",
    isHost: true,
    status: "reviewing",
  };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(
    source("../src/components/layout/ReturnToSetupDialog.tsx"),
    {
      exports,
      require: (name) =>
        name === "react"
          ? {
              useRef: () => ({ current: null }),
              useEffect() {},
              useState: (value) => [value, (next) => updates.push(next)],
            }
          : name === "react/jsx-runtime"
            ? { jsx, jsxs: jsx }
            : name.includes("useRoomStore")
              ? { useRoomStore: { getState: () => room } }
              : name.includes("useSessionStore")
                ? {
                    useSessionStore: {
                      getState: () => ({ designPreset: null }),
                    },
                  }
                : name.includes("lib/socket")
                  ? {
                      socket: {
                        timeout: () => ({ emit: (...args) => sent.push(args) }),
                      },
                    }
                  : {},
    },
  );
  const tree = exports.default({
    request: { code: "ABCDE", roundId: "round-a" },
    onClose: () => closed++,
    onReturned: () => returned++,
  });
  assert.equal(tree.props.role, "alertdialog");
  const buttons = tree.props.children.at(-1).props.children;
  assert.equal(sent.length, 0);
  buttons[0].props.onClick();
  assert.equal(closed, 1);
  assert.equal(sent.length, 0);
  buttons[1].props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].status, "waiting");
  sent[0][2](null, { ok: false, error: { message: "Please reconnect" } });
  assert.equal(updates.at(-1), "Please reconnect");
  assert.equal(returned, 0);
  room.roundId = "round-b";
  buttons[1].props.onClick();
  assert.equal(sent.length, 1);
  room.roundId = "round-a";
  buttons[1].props.onClick();
  sent[1][2](null, { ok: true });
  assert.equal(returned, 1);
});
test("scheduled camera callbacks retain their original frame and fire at most once", () => {
  const refs = [],
    effects = [],
    timers = [];
  let cursor = 0,
    stateCursor = 0;
  const captured = [];
  const documentMock = {
    createElement: () => canvas,
    visibilityState: "visible",
  };
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
    document: documentMock,
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
  const render = (frame, preserveSourceAspect = false) => {
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
      preserveSourceAspect,
      onCapture: (data, index, round) => captured.push({ index, round }),
    });
  };
  render(0);
  refs[1].current = { readyState: 4, videoWidth: 1280, videoHeight: 720 };
  effects.at(-1)();
  render(1); // A newer render updates callback refs while the earlier timer is still queued.
  timers[0]();
  timers[0]();
  assert.equal(captured.length, 1);
  assert.equal(captured[0].index, 0);
  assert.equal(captured[0].round, "round");
  assert.equal(canvas.width / canvas.height, 0.75);
  effects.at(-1)(); // schedule frame 1
  documentMock.visibilityState = "hidden";
  timers.at(-1)();
  assert.equal(captured.length, 1); // a backgrounded phone must not upload a stale frame
  documentMock.visibilityState = "visible";
  render(2, true);
  effects.at(-1)();
  timers.at(-1)();
  assert.equal(captured.length, 2);
  assert.equal(canvas.width / canvas.height, 1280 / 720); // mixed layouts preserve the camera's full image
});
test("external camera selection requests the exact device, releases it, and never falls back silently", async () => {
  async function open(fail) {
    const refs = [],
      effects = [],
      requests = [],
      errors = [],
      mirrors = [];
    let stopped = 0;
    const track = {
      getSettings: () => ({ deviceId: "usb-camera" }),
      stop: () => stopped++,
    };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
    const exports = {};
    vm.runInNewContext(source("../src/components/capture/CameraView.tsx"), {
      exports,
      Set,
      Error,
      navigator: {
        mediaDevices: {
          getUserMedia: async (constraints) => {
            requests.push(constraints);
            if (fail)
              throw Object.assign(new Error("External camera unavailable"), {
                name: "OverconstrainedError",
              });
            return stream;
          },
          enumerateDevices: async () => [],
        },
      },
      require: (name) =>
        name === "react"
          ? {
              useRef: (value) => {
                const ref = { current: value };
                refs.push(ref);
                return ref;
              },
              useState: (initial) => [initial, () => {}],
              useEffect: (effect) => effects.push(effect),
            }
          : name.includes("deviceSupport")
            ? { cameraErrorMessage: (error) => error.message }
            : {
                jsx: (type, props) => ({ type, props }),
                jsxs: (type, props) => ({ type, props }),
              },
    });
    exports.default({
      deviceId: "usb-camera",
      isCountingDown: false,
      timerSeconds: 3,
      frameIndex: 0,
      roundId: null,
      onCapture: () => {},
      onError: (message) => errors.push(message),
      onMirroredChange: (value) => mirrors.push(value),
    });
    refs[1].current = { srcObject: null, play: async () => {} };
    const cleanup = effects[0]();
    await new Promise(setImmediate);
    cleanup();
    return { requests, errors, mirrors, stopped };
  }
  const connected = await open(false);
  assert.equal(connected.requests[0].video.deviceId.exact, "usb-camera");
  assert.equal(connected.requests[0].audio, false);
  assert.equal(connected.mirrors[0], false);
  assert.equal(connected.stopped, 1);
  const missing = await open(true);
  assert.equal(missing.requests.length, 1);
  assert.equal(missing.errors[0], "External camera unavailable");
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
        ? {
            getLayout: () => ({ frameAspectRatio: 1 }),
            slotAspectRatio: () => 1,
          }
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

test("custom frames fit within print boundaries at every orientation, count and sideways angle", () => {
  const geometry = {};
  vm.runInNewContext(source("../src/lib/customLayout.ts"), {
    exports: geometry,
  });
  for (const aspect of [0.75, 1, 1.5])
    for (let count = 1; count <= 12; count++) {
      const layout = geometry.customGrid(count, aspect, true);
      assert.equal(layout.frames.length, count);
      for (const original of layout.frames)
        for (const rotation of [-90, -45, 0, 45, 90]) {
          const f = geometry.fitFrame(
            { ...original, x: -40, y: 120, rotation },
            aspect,
          );
          const angle = (rotation * Math.PI) / 180;
          const w =
            Math.abs(Math.cos(angle)) * f.width +
            Math.abs(Math.sin(angle)) * f.height * aspect;
          const h =
            (Math.abs(Math.sin(angle)) * f.width) / aspect +
            Math.abs(Math.cos(angle)) * f.height;
          assert.ok(f.x + f.width / 2 - w / 2 >= 0);
          assert.ok(f.x + f.width / 2 + w / 2 <= 100);
          assert.ok(f.y + f.height / 2 - h / 2 >= 0);
          assert.ok(f.y + f.height / 2 + h / 2 <= 90);
        }
    }
});

test("custom layout slot count and photo aspect ratios resolve from saved geometry", () => {
  const layouts = {};
  vm.runInNewContext(source("../src/data/stripLayouts.ts"), {
    exports: layouts,
  });
  const custom = {
    aspectRatio: 1.5,
    frames: [
      { x: 10, y: 10, width: 40, height: 30, rotation: -10 },
      { x: 55, y: 15, width: 25, height: 60, rotation: 0 },
    ],
  };
  const result = layouts.getLayout("custom", custom);
  assert.equal(result.slotCount, 2);
  assert.equal(result.stripAspectRatio, 1.5);
  assert.equal(layouts.slotAspectRatio(result, 0), 2);
  assert.equal(layouts.slotAspectRatio(result, 1), 0.625);
  assert.equal(result.slots[0].free.rotation, -10);
});

test("quick resizing preserves photo proportions and its center until print bounds intervene", () => {
  const geometry = {};
  vm.runInNewContext(source("../src/lib/customLayout.ts"), {
    exports: geometry,
  });
  const original = { x: 30, y: 30, width: 20, height: 30, rotation: 15 };
  const larger = geometry.resizeFrame(original, 1.1, 0.75);
  assert.ok(
    Math.abs(larger.width / larger.height - original.width / original.height) <
      1e-10,
  );
  assert.ok(Math.abs(larger.x + larger.width / 2 - 40) < 1e-10);
  assert.ok(Math.abs(larger.y + larger.height / 2 - 45) < 1e-10);
  for (const factor of [0.01, 100]) {
    const resized = geometry.resizeFrame(original, factor, 0.75);
    assert.ok(Math.abs(resized.width / resized.height - 2 / 3) < 1e-10);
    assert.ok(resized.width > 0 && resized.height > 0);
  }
});

test("restart card sends nothing until confirmed and ignores a round that has already changed", () => {
  const exports = {},
    sent = [],
    updates = [];
  let closed = 0;
  const room = {
    roomCode: "ABCDE",
    isHost: true,
    roundId: "round-a",
    status: "capturing",
  };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(
    source("../src/components/capture/RestartRoundDialog.tsx"),
    {
      exports,
      require: (name) =>
        name === "react"
          ? {
              useRef: () => ({ current: null }),
              useEffect() {},
              useState: (value) => [value, (next) => updates.push(next)],
            }
          : name === "react/jsx-runtime"
            ? { jsx, jsxs: jsx }
            : name.includes("useRoomStore")
              ? { useRoomStore: { getState: () => room } }
              : name.includes("lib/socket")
                ? { socket: { emit: (...args) => sent.push(args) } }
                : {},
    },
  );
  const tree = exports.default({ roundId: "round-a", onClose: () => closed++ });
  const buttons = tree.props.children.at(-1).props.children;
  assert.equal(sent.length, 0);
  buttons[0].props.onClick();
  assert.equal(closed, 1);
  assert.equal(sent.length, 0);
  buttons[1].props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "update-room-state");
  assert.equal(sent[0][1].status, "ready");
  sent[0][2]({ ok: false, error: { message: "Please reconnect" } });
  assert.equal(updates.at(-1), "Please reconnect");
  room.roundId = "round-b";
  buttons[1].props.onClick();
  assert.equal(sent.length, 1);
  assert.equal(closed, 2);
});

test("the footer caption reads live session text when no preview override is provided", () => {
  const exports = {},
    fonts = {};
  vm.runInNewContext(source("../src/data/textStyles.ts"), { exports: fonts });
  const state = {
    stripTitle: "First caption",
    titleStyle: fonts.DEFAULT_TITLE_STYLE,
    titlePosition: { x: 50, y: 90, auto: true },
    customLayout: null,
    customDesigns: [],
    designPreset: null,
  };
  const hooks = {
    forwardRef: (fn) => fn,
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
    useEffect() {},
  };
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(source("../src/components/editor/StripCanvas.tsx"), {
    exports,
    require: (name) =>
      name === "react"
        ? { ...hooks, default: hooks }
        : name === "react/jsx-runtime"
          ? { jsx, jsxs: jsx }
          : name.includes("textStyles")
            ? fonts
            : name.includes("useSessionStore")
              ? { useSessionStore: (selector) => selector(state) }
              : name.includes("stripLayouts")
                ? {
                    getLayout: () => ({
                      id: "4x1",
                      slots: [],
                      columns: 1,
                      rows: 4,
                      stripAspectRatio: 0.4,
                      paddingFraction: 0.05,
                      bottomPaddingFraction: 0.15,
                      gapFraction: 0.02,
                    }),
                  }
                : name.includes("themePacks")
                  ? {
                      ALL_DESIGNS: [
                        { id: "solid-white", background: "#ffffff" },
                      ],
                    }
                  : name.includes("stripEdges")
                    ? { stripEdgeStyle: () => ({}) }
                    : name.includes("designBackground")
                      ? { designBackground: () => ({}) }
                      : {},
  });
  const caption = (tree) => {
    if (!tree || typeof tree !== "object") return undefined;
    if (tree.props?.["data-caption-text"]) return tree.props.children;
    const children = tree.props?.children;
    for (const child of Array.isArray(children) ? children : [children]) {
      const found = caption(child);
      if (found !== undefined) return found;
    }
  };
  const props = { layoutId: "4x1", designId: "solid-white" };
  assert.equal(caption(exports.StripCanvas(props, null)), "First caption");
  state.stripTitle = "A new memory";
  assert.equal(caption(exports.StripCanvas(props, null)), "A new memory");
  state.stripTitle = "";
  assert.equal(caption(exports.StripCanvas(props, null)), undefined);
});

test("text layers drag in print percentages on a scaled preview, commit on release and stay read-only on export", () => {
  const exports = {},
    committed = [];
  const layer = {
    id: "text-1",
    text: "Hello",
    x: 50,
    y: 50,
    width: 60,
    fontSize: 72,
    rotation: 0,
    style: {
      font: "modern",
      size: 1,
      color: "#ffffff",
      bold: true,
      italic: false,
    },
  };
  const store = (selector) => selector({ textLayers: [layer] });
  store.getState = () => ({
    updateTextLayer: (...args) => committed.push(args),
  });
  const jsx = (type, props) => ({ type, props });
  vm.runInNewContext(source("../src/components/editor/TextLayers.tsx"), {
    exports,
    require: (name) =>
      name === "react"
        ? {
            useRef: (value) => ({ current: value }),
            useState: (value) => [value, () => {}],
            useEffect() {},
          }
        : name === "react/jsx-runtime"
          ? { jsx, jsxs: jsx }
          : name.includes("useSessionStore")
            ? { useSessionStore: store }
            : name.includes("textStyles")
              ? { titleFont: () => "Arial" }
              : {},
  });
  const render = (editable) => {
    const list = exports.default({
      editable,
      selectedId: layer.id,
      autoColor: "#333333",
      onSelect: () => {},
    });
    const item = list.props.children[0];
    return item.type(item.props);
  };
  const editing = render(true);
  const event = {
    button: 0,
    pointerId: 1,
    clientX: 100,
    clientY: 200,
    stopPropagation() {},
    preventDefault() {},
    target: { closest: () => null },
    currentTarget: {
      parentElement: {
        getBoundingClientRect: () => ({
          left: 0,
          top: 0,
          width: 250,
          height: 500,
        }),
      },
      setPointerCapture() {},
    },
  };
  editing.props.onPointerDown(event);
  editing.props.onPointerMove({ ...event, clientX: 125, clientY: 250 });
  assert.equal(committed.length, 0);
  editing.props.onPointerUp(event);
  assert.equal(committed[0][1].x, 60);
  assert.equal(committed[0][1].y, 60);
  editing.props.onPointerDown(event);
  editing.props.onPointerMove({ ...event, clientX: 200 });
  editing.props.onPointerCancel();
  assert.equal(committed.length, 1);
  const output = render(false);
  assert.equal(output.props.style.pointerEvents, "none");
  assert.equal(output.props.children[1], false);
  assert.equal(output.props.children[0], "Hello");
});
