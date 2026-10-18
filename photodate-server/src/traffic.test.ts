import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { request } from "node:http";
process.env.DB_PATH = ":memory:";
process.env.MAX_IN_FLIGHT_REQUESTS = "1";
const { httpServer, io } = require("./index") as typeof import("./index");
const { default: db } = require("./db") as typeof import("./db");
test("busy requests get Retry-After before body parsing and capacity returns after disconnect", async () => {
  httpServer.listen(0, "127.0.0.1");
  await once(httpServer, "listening");
  const port = (httpServer.address() as { port: number }).port;
  const blocked = request({
    hostname: "127.0.0.1",
    port,
    path: "/rooms",
    method: "POST",
    headers: { "Content-Type": "application/json", "Content-Length": "100000" },
  });
  blocked.on("error", () => {});
  try {
    const arrived = once(httpServer, "request");
    blocked.write("{");
    await arrived;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "2");
    await response.text();
    blocked.destroy();
    let status = 503;
    for (let i = 0; i < 20 && status === 503; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      const next = await fetch(`http://127.0.0.1:${port}/health`);
      status = next.status;
      await next.text();
    }
    assert.equal(status, 200);
  } finally {
    blocked.destroy();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    db.close();
  }
});
