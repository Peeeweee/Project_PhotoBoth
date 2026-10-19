import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
function catalog(file, dependencies = {}) {
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
  vm.runInNewContext(result.outputText, {
    exports,
    Math,
    require: (name) => dependencies[name],
  });
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

test("filter settings omit acknowledged photos and include replacement images", () => {
  const { editorPayload } = catalog("../src/lib/editorPayload.ts");
  const photo = "data:image/jpeg;base64," + "a".repeat(250000);
  const state = {
    assignedPhotos: [photo, photo],
    filterId: "mono",
    stripTitle: "Our date",
  };
  const patch = editorPayload(state, [photo, photo]);
  assert.equal(patch.assignedPhotos, undefined);
  assert.equal(patch.filterId, "mono");
  assert.ok(JSON.stringify(patch).length < 100);
  assert.equal(editorPayload(state, []).assignedPhotos, state.assignedPhotos);
  assert.equal(state.assignedPhotos.length, 2);
});

test("occasion templates reference available layouts, designs and filters", () => {
  const textStyles = catalog("../src/data/textStyles.ts");
  const { KEEPSAKE_TEMPLATES } = catalog("../src/data/keepsakeTemplates.ts", {
    "./textStyles": textStyles,
  });
  const { FILTER_PRESETS } = catalog("../src/data/filterPresets.ts");
  assert.equal(KEEPSAKE_TEMPLATES.length, 8);
  assert.equal(new Set(KEEPSAKE_TEMPLATES.map((t) => t.id)).size, 8);
  for (const template of KEEPSAKE_TEMPLATES) {
    assert.ok(
      AVAILABLE_LAYOUTS.some((l) => l.id === template.layoutId),
      template.id,
    );
    assert.ok(
      ALL_DESIGNS.some((d) => d.id === template.designId),
      template.id,
    );
    assert.ok(
      FILTER_PRESETS.some((f) => f.id === template.filterId),
      template.id,
    );
    assert.ok(template.title.length > 0);
  }
});

test("photo adjustments preserve the source and clamp dragging inside supported bounds", () => {
  const { DEFAULT_PHOTO_EDIT, photoPresentation, panPhoto } = catalog(
    "../src/lib/photoEdit.ts",
  );
  const initial = { ...DEFAULT_PHOTO_EDIT, fit: "cover", zoom: 2 };
  const moved = panPhoto(initial, 20, -10, 200, 100);
  assert.equal(moved.x, -10);
  assert.equal(moved.y, 10);
  assert.equal(initial.x, 0);
  assert.equal(photoPresentation(moved).objectPosition, "40% 60%");
  assert.equal(photoPresentation(moved).transform, "scale(2)");
  const clamped = panPhoto(initial, 9999, -9999, 0, 0);
  assert.equal(clamped.x, -50);
  assert.equal(clamped.y, 50);
  assert.equal(photoPresentation().objectFit, "contain");
  assert.throws(() =>
    editorDocument({ photoEdits: [{ fit: "cover", zoom: 4, x: 0, y: 0 }] }),
  );
  assert.throws(() =>
    editorDocument({ photoEdits: [{ fit: "stretch", zoom: 1, x: 0, y: 0 }] }),
  );
  assert.doesNotThrow(() =>
    editorDocument({ photoEdits: [moved], photoSources: [1, null] }),
  );
});

test("all studio themes apply distinct readable UI palettes and clear old inline overrides", () => {
  const styles = catalog("../src/data/photoStyles.ts");
  const studio = catalog("../src/data/studioThemes.ts");
  const themes = catalog("../src/data/themes.ts", { "./photoStyles": styles });
  const properties = new Map();
  const root = {
    dataset: {},
    classList: { contains: () => true },
    style: {
      removeProperty: (key) => properties.delete(key),
      setProperty: (key, value, priority) =>
        properties.set(key, { value, priority }),
    },
  };
  const exports = {};
  const compiled = ts.transpileModule(
    readFileSync(new URL("../src/lib/applyTheme.ts", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(compiled, {
    exports,
    document: {
      documentElement: root,
      body: { classList: { remove() {}, add() {} } },
    },
    require: (name) => (name.includes("studioThemes") ? studio : themes),
  });
  const luminance = (hex) => {
    const channels = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const backgrounds = new Set();
  for (const style of styles.PHOTO_STYLES) {
    exports.applyTheme(style.id);
    const tokens = studio.studioTokens(style.id);
    assert.equal(root.dataset.photoStyle, style.id);
    assert.equal(properties.get("--c-bg").value, tokens["--c-bg"]);
    assert.equal(properties.get("--c-bg").priority, "important");
    assert.ok(
      1.05 / (luminance(tokens["--studio-button"]) + 0.05) >= 4.5,
      style.id + " button contrast",
    );
    assert.ok(
      (luminance(tokens["--c-text-md"]) + 0.05) /
        (luminance(tokens["--c-surface-1"]) + 0.05) >=
        4.5,
      style.id + " body contrast",
    );
    backgrounds.add(tokens["--c-bg"]);
  }
  assert.equal(backgrounds.size, 8);
  exports.resetTheme();
  assert.equal(properties.size, 0);
});

test("photo styles resolve to existing export designs and supported filters without changing legacy identities", () => {
  const { PHOTO_STYLES, getPhotoStyle } = catalog("../src/data/photoStyles.ts");
  const { FILTER_PRESETS } = catalog("../src/data/filterPresets.ts");
  assert.equal(PHOTO_STYLES.length, 8);
  assert.equal(new Set(PHOTO_STYLES.map((s) => s.id)).size, 8);
  for (const style of PHOTO_STYLES) {
    const preset = ALL_DESIGNS.find((d) => d.id === style.designId);
    assert.ok(preset, style.id);
    assert.equal(design(preset).id, preset.id);
    assert.ok(
      FILTER_PRESETS.some((f) => f.id === style.filterId),
      style.id,
    );
    assert.equal(getPhotoStyle(style.id).id, style.id);
  }
  assert.equal(getPhotoStyle("meme").name, "Playful");
  assert.equal(getPhotoStyle("old-or-unknown").id, "classic");
});
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
