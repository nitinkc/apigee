# Deep Dive — Testing Proxies

Debug sessions find one problem at a time. Production proxies need automated
tests in CI. There are four layers; this repo ships working examples of the
first three.

!!! abstract "By the end you can..."
    - Lint a bundle statically.
    - Unit-test a JavaScript policy locally with a fake `context`.
    - Smoke-test a deployed proxy from a script.
    - Choose a tool for deeper integration/contract tests.

| Layer | Needs Apigee? | Catches | Tool |
|---|:-:|---|---|
| 1. Static lint | no | wrong names, missing policies, bad config | `apigeelint` |
| 2. Unit (JS callouts) | no | logic bugs in scripts | Node test runner / Jest / Mocha |
| 3. Smoke | yes | "is it up and does the contract hold?" | `curl` script |
| 4. Integration / contract | yes | multi-step flows, auth, schemas | apickli (Cucumber), Postman/newman, Schemathesis |

## 1. Static lint

```bash
npm i -g apigeelint
apigeelint -s examples/labs-proxy/apiproxy -f table.js
```

Fails on unused policies, step names without a file, and many best-practice
rules. Run it on every merge request (see
[Deploy & CI/CD](../deploy-cicd.md)).

## 2. Unit-testing JavaScript

The script runs on Apigee's Rhino engine, but its logic only depends on the
global `context`. Fake `context`, execute the script, assert on what it wrote.
This repo includes
`examples/labs-proxy/tests/shapeResponse.test.js`.

```javascript
function run(vars) {
  const written = {};
  const context = { // (1)!
    getVariable: (k) => (k in vars ? vars[k] : null),
    setVariable: (k, v) => { written[k] = v; },
  };
  vm.runInNewContext(SCRIPT, { context, print: () => {}, JSON }); // (2)!
  return written; // (3)!
}
```

1. A stand-in for Apigee's `context`: unset variables return `null`, exactly
   like the real thing.
2. Run the *real* script file in an isolated sandbox with `context` and
   `print` provided.
3. Return everything the script wrote, so tests assert on outputs.

```bash
cd examples/labs-proxy
node --test tests/shapeResponse.test.js
```

The four tests cover a cache miss, `/orders/{id}` enrichment, a cache hit
(annotate-only), and a non-JSON upstream.

!!! note "Rhino vs Node"
    The sandbox is V8, so ES6+ code would pass here but fail in Apigee. Keep
    scripts **ES5-style** (`var`, no arrow functions/template strings) — the
    shipped script already is — and keep one smoke test as the real check.

## 3. Smoke test a deployment

`examples/labs-proxy/tests/smoke.sh`
sends five representative requests and fails the build if a status differs:

```bash
APIGEE_HOST=eval-group.my-org.apigee.net APIKEY=$APIKEY ./tests/smoke.sh
```

```
PASS  hello is open (200)
PASS  orders needs a key (401)
PASS  orders with key (200)
PASS  missing customerId -> 400 (400)
PASS  CORS preflight (204)
```

Notes: it sleeps between calls because `SA-Global` allows ~one request every
five seconds; in a real environment raise the rate for the test key or test
against a dedicated environment.

## 4. Integration & contract testing

- **apickli** (Cucumber/Gherkin): readable scenarios, widely used with Apigee.
- **Postman + newman**: collection runs in CI with environment files.
- **Spec-driven** (Schemathesis, Dredd): generate requests from the OpenAPI
  spec ([OpenAPI-first](openapi-first.md)) and check responses conform.
- **Negative tests matter**: missing key, expired token, wrong scope, oversized
  body, quota exhaustion. Most proxy bugs live on these paths.

```gherkin
Scenario: anonymous call is rejected
  When I GET /orders
  Then response code should be 401
  And response body path $.error.code should be UNAUTHORIZED
```

## A sensible CI order

1. `apigeelint` and `node --test` (seconds, no Apigee needed).
2. Deploy to **dev** (import once → revision N).
3. Smoke + integration tests against dev.
4. Promote revision N to stage; repeat a smaller suite.
5. Manual gate → prod.

## Experiments

1. Break the script (change `"hit (edge)"`) and see which unit test fails.
2. Add a unit test for the `quota` fields when no quota variables exist.
3. Extend `smoke.sh` with a JWT mint-and-verify round trip.

## Check yourself

??? question "1. What can a unit test of `shapeResponse.js` *not* tell you?"
    Whether Apigee actually populates the variables the script reads (names,
    timing, which flow). That needs a deployed smoke/integration test.

??? question "2. Why keep scripts ES5-style when your unit tests run on modern Node?"
    Apigee's JS engine is Rhino; newer syntax can pass locally and fail at runtime.

??? question "3. Name three negative cases you would always test."
    No credentials, expired/invalid credentials, quota/spike exceeded (also bad
    input, wrong scope).
