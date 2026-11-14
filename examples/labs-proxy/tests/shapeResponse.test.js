// Unit test for apiproxy/resources/jsc/shapeResponse.js using Node's built-in runner.
// Run: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SCRIPT = fs.readFileSync(
  path.join(__dirname, "../apiproxy/resources/jsc/shapeResponse.js"),
  "utf8"
);

// Run the policy script against a fake Apigee `context`; returns the variables it wrote.
function run(vars) {
  const written = {};
  const context = {
    getVariable: (k) => (k in vars ? vars[k] : null),
    setVariable: (k, v) => { written[k] = v; },
  };
  vm.runInNewContext(SCRIPT, { context, print: () => {}, JSON });
  return written;
}

test("cache miss wraps upstream body with app, developer and quota", () => {
  const out = run({
    "developer.app.name": "labs-app",
    "developer.email": "you@example.com",
    "response.content": '{"hello":"world"}',
    "ratelimit.Quota-PerApp.allowed.count": 10,
    "ratelimit.Quota-PerApp.used.count": 3,
    "ratelimit.Quota-PerApp.available.count": 7,
  });
  const body = JSON.parse(out["response.content"]);
  assert.strictEqual(body.message, "orders list");
  assert.strictEqual(body.app, "labs-app");
  assert.deepStrictEqual(body.quota, { allowed: 10, used: 3, available: 7 });
  assert.deepStrictEqual(body.upstream, { hello: "world" });
  assert.strictEqual(body.cache, "miss (backend)");
  assert.strictEqual(out["response.header.content-type"], "application/json");
});

test("order id and callout enrichment appear on /orders/{id}", () => {
  const out = run({
    "urirequest.orderId": "42",
    "ipResponse.content": '{"origin":"203.0.113.7"}',
    "response.content": "{}",
  });
  const body = JSON.parse(out["response.content"]);
  assert.strictEqual(body.message, "order 42");
  assert.strictEqual(body.enrichedFrom, "203.0.113.7");
});

test("cache hit is only annotated, not re-wrapped", () => {
  const out = run({
    "responsecache.RC-Orders.cachehit": true,
    "response.content": '{"message":"orders list","app":"x"}',
  });
  const body = JSON.parse(out["response.content"]);
  assert.strictEqual(body.cache, "hit (edge)");
  assert.strictEqual(body.message, "orders list");
  assert.strictEqual(body.upstream, undefined);
});

test("non-JSON upstream body is preserved under raw", () => {
  const out = run({ "response.content": "plain text" });
  assert.strictEqual(JSON.parse(out["response.content"]).upstream.raw, "plain text");
});
