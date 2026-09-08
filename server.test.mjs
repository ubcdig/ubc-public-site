import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createUbcServer } from "./server.mjs";

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

test("serves the UBC homepage with security headers", async () => {
  const server = createUbcServer();
  const baseUrl = await listen(server);
  try {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Healthcare data/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  } finally {
    await close(server);
  }
});

test("proxies a bounded inquiry without logging or persisting it", async () => {
  let received = null;
  const upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    response.writeHead(201, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ id: "lead-test" }));
  });
  const upstreamUrl = await listen(upstream);
  const server = createUbcServer({ leadApiUrl: upstreamUrl });
  const baseUrl = await listen(server);
  try {
    const payload = { organizationName: "Hospital", consentAccepted: true };
    const response = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(received, payload);
    assert.deepEqual(await response.json(), { id: "lead-test" });
  } finally {
    await close(server);
    await close(upstream);
  }
});

test("rejects traversal and oversized inquiry bodies", async () => {
  const server = createUbcServer();
  const baseUrl = await listen(server);
  try {
    const traversal = await fetch(`${baseUrl}/%2e%2e/package.json`);
    assert.notEqual(traversal.status, 200);
    const oversized = await fetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "x".repeat(17_000) }),
    });
    assert.equal(oversized.status, 413);
  } finally {
    await close(server);
  }
});
