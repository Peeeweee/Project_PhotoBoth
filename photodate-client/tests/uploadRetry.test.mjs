import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(
  readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8").replace(
    "import.meta.env.VITE_SERVER_URL",
    "undefined",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function client(responses) {
  const calls = [],
    exports = {};
  vm.runInNewContext(source, {
    exports,
    AbortSignal,
    DOMException,
    TypeError,
    Math,
    Promise,
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    fetch: async (url, options) => {
      calls.push({ url, ...options });
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return {
        ok: response < 400,
        status: response,
        headers: { get: () => "2" },
        json: async () => ({
          status: response < 400 ? "ok" : "error",
          message: "test",
        }),
      };
    },
    require: (name) =>
      name.includes("useRoomStore")
        ? {
            useRoomStore: {
              getState: () => ({
                sessionToken: "credential",
                roundId: "round",
              }),
            },
          }
        : { normalizeRoomCode: (code) => code.trim().toUpperCase() },
  });
  return { api: exports, calls };
}
test("transient upload failures retry the identical round/frame while preserving credentials", async () => {
  const c = client([503, new TypeError("network lost"), 201]);
  await c.api.uploadCapture("abcde", "person", 2, "image", "round");
  assert.equal(c.calls.length, 3);
  assert.equal(new Set(c.calls.map((call) => call.body)).size, 1);
  assert.equal(c.calls[0].headers.Authorization, "Bearer credential");
});
test("stale rounds and rejected credentials are never retried", async () => {
  for (const status of [400, 401, 403, 409, 413]) {
    const c = client([status]);
    await assert.rejects(
      c.api.uploadCapture("ABCDE", "person", 2, "image", "round"),
    );
    assert.equal(c.calls.length, 1);
  }
});
test("upload retries are bounded and room creation never retries automatically", async () => {
  const c = client([503, 503, 503]);
  await assert.rejects(
    c.api.uploadCapture("ABCDE", "person", 2, "image", "round"),
  );
  assert.equal(c.calls.length, 3);
  const create = client([503]);
  await assert.rejects(create.api.createRoom("Host"));
  assert.equal(create.calls.length, 1);
});
