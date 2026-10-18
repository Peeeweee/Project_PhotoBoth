import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
function catalog(file) {
  const exports = {};
  const result = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  );
  vm.runInNewContext(result.outputText, { exports, Math });
  return exports;
}
const {
  AVAILABLE_LAYOUTS,
  getLayout,
  computeStripAspectRatio,
  slotAspectRatio,
} = catalog("../src/data/stripLayouts.ts");
const { ALL_DESIGNS } = catalog("../src/data/themePacks.ts");
const { EDGE_STYLES, stripEdgeStyle } = catalog("../src/lib/stripEdges.ts");
// CI builds the server before client checks; isolate this validation from any user database.
process.env.DB_PATH = ":memory:";
const require = createRequire(import.meta.url);
const {
  design,
  layouts,
  editorDocument,
} = require("../../photodate-server/dist/runtime.js");
const { default: db } = require("../../photodate-server/dist/db.js");
after(() => db.close());
test("all sixteen layouts have unique identities, nonoverlapping geometry and server support", () => {
  assert.equal(AVAILABLE_LAYOUTS.length, 16);
  assert.equal(new Set(AVAILABLE_LAYOUTS.map((l) => l.id)).size, 16);
  for (const l of AVAILABLE_LAYOUTS) {
    assert.ok(layouts.includes(l.id), l.id);
    assert.equal(getLayout(l.id).id, l.id);
    assert.equal(l.slots.length, l.slotCount);
    assert.equal(new Set(l.slots.map((s) => s.index)).size, l.slotCount);
    assert.equal(
      l.stripAspectRatio,
      computeStripAspectRatio(
        l.columns,
        l.rows,
        l.frameAspectRatio,
        l.gapFraction,
        l.paddingFraction,
        l.bottomPaddingFraction,
      ),
    );
    assert.ok(l.slotCount >= 1 && l.slotCount <= 12);
    const occupied = new Set();
    for (const s of l.slots) {
      assert.ok(
        s.col >= 0 &&
          s.row >= 0 &&
          s.col + s.colSpan <= l.columns &&
          s.row + s.rowSpan <= l.rows,
      );
      for (let row = s.row; row < s.row + s.rowSpan; row++)
        for (let col = s.col; col < s.col + s.colSpan; col++) {
          const cell = `${row}:${col}`;
          assert.equal(occupied.has(cell), false, l.id);
          occupied.add(cell);
        }
      assert.ok(slotAspectRatio(l, s.index) > 0);
    }
    if (l.mixed) {
      assert.ok(l.slots.some((s) => slotAspectRatio(l, s.index) < 1));
      assert.ok(l.slots.some((s) => slotAspectRatio(l, s.index) > 1));
    }
  }
});
test("every curated design and edge survives server validation", () => {
  assert.ok(ALL_DESIGNS.length >= 40);
  assert.equal(new Set(ALL_DESIGNS.map((d) => d.id)).size, ALL_DESIGNS.length);
  for (const preset of ALL_DESIGNS)
    for (const edge of EDGE_STYLES) {
      const accepted = design({ ...preset, edgeStyle: edge.id });
      assert.equal(accepted.id, preset.id);
      assert.equal(accepted.edgeStyle, edge.id);
      assert.equal(accepted.background, preset.background);
    }
  assert.throws(() => design({ ...ALL_DESIGNS[0], edgeStyle: "unknown" }));
});
test("export edge masks stay inside each layout and use the same shape at preview sizes", () => {
  for (const l of AVAILABLE_LAYOUTS)
    for (const edge of EDGE_STYLES) {
      const style = stripEdgeStyle(edge.id, l.stripAspectRatio);
      if (style.clipPath) {
        assert.match(style.clipPath, /^polygon\(/);
        for (const value of style.clipPath.match(/[\d.]+(?=%)/g))
          assert.ok(Number(value) >= 0 && Number(value) <= 100);
      }
      assert.equal(
        stripEdgeStyle(edge.id, l.stripAspectRatio, 65).clipPath,
        style.clipPath,
      );
    }
});

test("automatic footer placement survives synchronization and manual positions remain supported", () => {
  const accepted = editorDocument({
    titlePosition: { x: 50, y: 90, auto: true },
  });
  assert.equal(accepted.titlePosition.auto, true);
  assert.equal(
    editorDocument({ titlePosition: { x: 50, y: 99, auto: false } })
      .titlePosition.y,
    99,
  );
  assert.throws(() =>
    editorDocument({ titlePosition: { x: 50, y: 90, auto: "yes" } }),
  );
});
