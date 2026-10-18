import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Exercise the component's pointer handlers with a scaled DOM surface, without a camera or server.
const source = ts.transpileModule(
  readFileSync(
    new URL("../src/components/editor/DraggableSticker.tsx", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function surface(readOnly = false) {
  const listeners = new Map(),
    frames = new Map(),
    updates = [];
  let nextFrame = 0;
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name, fn) => {
      if (listeners.get(name) === fn) listeners.delete(name);
    },
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    window,
    Math,
    requestAnimationFrame: (fn) => {
      frames.set(++nextFrame, fn);
      return nextFrame;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    require: (name) => {
      if (name === "react")
        return { useRef: (current) => ({ current }), useEffect: () => {} };
      if (name === "react/jsx-runtime")
        return {
          jsx: (type, props) => ({ type, props }),
          jsxs: (type, props) => ({ type, props }),
          Fragment: "fragment",
        };
      if (name === "lucide-react") return {};
      throw new Error(`Unexpected import ${name}`);
    },
  });
  const parent = {
    offsetWidth: 1000,
    offsetHeight: 2000,
    getBoundingClientRect: () => ({
      left: 20,
      top: 30,
      width: 200,
      height: 400,
    }),
  };
  let captured = false;
  const el = {
    parentElement: parent,
    style: { setProperty() {} },
    setPointerCapture: () => {
      captured = true;
    },
    hasPointerCapture: () => captured,
    releasePointerCapture: () => {
      captured = false;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  const tree = exports.default({
    sticker: { id: "s", x: 200, y: 300, scale: 1, rotation: 0 },
    url: "star.svg",
    isSelected: true,
    readOnly,
    onSelect() {},
    onUpdate: (id, value) => updates.push({ id, ...value }),
    onRemove() {},
  });
  tree.props.ref.current = el;
  const event = (x, y, type = "pointermove", pointerId = 1) => ({
    clientX: x,
    clientY: y,
    type,
    pointerId,
    pointerType: "mouse",
    button: 0,
    currentTarget: el,
    stopPropagation() {},
    preventDefault() {},
  });
  return {
    tree,
    el,
    updates,
    event,
    send: (type, x, y, pointerId = 1) =>
      listeners.get(type)?.(event(x, y, type, pointerId)),
    paint: () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((fn) => fn());
    },
    listeners,
  };
}
test("scaled preview follows screen movement immediately and commits once on release", () => {
  const s = surface();
  s.tree.props.onPointerDown(s.event(60, 90));
  s.send("pointermove", 80, 130);
  s.send("pointermove", 100, 150);
  assert.equal(s.updates.length, 0);
  s.paint();
  assert.match(s.el.style.transform, /translate\(400px, 600px\)/); // 40 screen pixels / 0.2 scale = 200 canvas pixels
  s.send("pointerup", 110, 160);
  assert.equal(s.updates.length, 1);
  assert.equal(s.updates[0].x, 450);
  assert.equal(s.updates[0].y, 650);
  assert.equal(s.listeners.size, 0);
});
test("cancellation restores the original sticker and ignores other pointers", () => {
  const s = surface();
  s.tree.props.onPointerDown(s.event(60, 90));
  s.send("pointermove", 100, 150, 2);
  s.paint();
  assert.equal(s.el.style.transform, undefined);
  s.send("pointermove", 100, 150);
  s.paint();
  s.send("pointercancel", 100, 150);
  assert.match(s.el.style.transform, /translate\(200px, 300px\)/);
  assert.equal(s.updates.length, 0);
  assert.equal(s.listeners.size, 0);
});
test("dragging stays within the photo canvas and read-only stickers cannot move", () => {
  const s = surface();
  s.tree.props.onPointerDown(s.event(60, 90));
  s.send("pointerup", -1000, 10000);
  assert.equal(s.updates[0].x, 0);
  assert.equal(s.updates[0].y, 2000);
  const guest = surface(true);
  guest.tree.props.onPointerDown(guest.event(60, 90));
  assert.equal(guest.listeners.size, 0);
});

function findControl(node, label) {
  if (!node || typeof node !== "object") return undefined;
  if (node.props?.["aria-label"] === label) return node;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findControl(child, label);
    if (found) return found;
  }
}
test("resize and rotation follow the pointer without publishing intermediate changes", () => {
  const resize = surface();
  findControl(resize.tree, "Enlarge sticker").props.onPointerDown(
    resize.event(80, 110),
  );
  resize.send("pointermove", 100, 130);
  resize.paint();
  assert.match(resize.el.style.transform, /scale\(2\)/);
  assert.equal(resize.updates.length, 0);
  resize.send("pointerup", 100, 130);
  assert.equal(resize.updates[0].scale, 2);
  const rotate = surface();
  findControl(rotate.tree, "Rotate sticker").props.onPointerDown(
    rotate.event(80, 90),
  );
  rotate.send("pointermove", 60, 110);
  rotate.paint();
  assert.match(rotate.el.style.transform, /rotate\(90deg\)/);
  assert.equal(rotate.updates.length, 0);
  rotate.send("pointerup", 60, 110);
  assert.equal(rotate.updates[0].rotation, 90);
});
