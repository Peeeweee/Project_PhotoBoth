import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const folder = mkdtempSync(join(tmpdir(), "photodate-static-"));
mkdirSync(join(folder, "assets"));
writeFileSync(
  join(folder, "index.html"),
  "<!doctype html><title>PhotoDate test</title>",
);
writeFileSync(join(folder, "assets", "index-test.js"), "console.log('test')");
process.env.DB_PATH = ":memory:";
process.env.CLIENT_DIST = folder;
const { httpServer, io } = require("./index") as typeof import("./index");
const { default: db } = require("./db") as typeof import("./db");
test("single-service deployment serves SPA routes, cached assets and authenticated API aliases", async () => {
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const base = `http://127.0.0.1:${(httpServer.address() as { port: number }).port}`;
  try {
    for (const path of ["/", "/design", "/capture"]) {
      const response = await fetch(base + path, {
        headers: { Accept: "text/html" },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("Cache-Control"), "no-cache");
      assert.match(await response.text(), /PhotoDate test/);
    }
    const asset = await fetch(base + "/assets/index-test.js");
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("Cache-Control")!, /immutable/);
    await asset.text();
    for (const path of [
      "/api/missing",
      "/api/rooms/ZZZZZ",
      "/assets/missing.js",
    ]) {
      const response = await fetch(base + path, {
        headers: { Accept: "text/html" },
      });
      assert.equal(response.status, 404);
      assert.match(response.headers.get("Content-Type")!, /json/);
      await response.text();
    }
    const created = await fetch(base + "/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName: "Deploy test" }),
    });
    assert.equal(created.status, 201);
    const room = (await created.json()) as {
      code: string;
      sessionToken: string;
    };
    const restored = await fetch(base + "/api/rooms/" + room.code, {
      headers: { Authorization: `Bearer ${room.sessionToken}` },
    });
    assert.equal(restored.status, 200);
    await restored.text();
  } finally {
    await new Promise<void>((resolve) => io.close(() => resolve()));
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
