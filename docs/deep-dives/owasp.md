# Deep Dive — OWASP API Top 10 on Apigee

A gateway is a powerful control point, but it cannot fix everything. This page
maps the **OWASP API Security Top 10 (2023)** to what Apigee can do — and,
just as important, what must be done in the backend.

!!! abstract "By the end you can..."
    - Match each OWASP API risk to an Apigee control.
    - Recognise the risks a gateway cannot solve alone.

| # | Risk | Apigee control | Where in this guide | Gateway enough? |
|---|---|---|---|:-:|
| API1 | Broken object-level authorization (BOLA) | Pass the verified identity (`developer.email`, claims) to the backend; never trust IDs from the client alone | [Lab 3](../labs/oauth-jwt.md) | **No** — backend must check ownership |
| API2 | Broken authentication | `VerifyAPIKey`, `OAuthV2`, `VerifyJWT` (pinned algorithm, short expiry), no `continueOnError` on gates | Labs 2–3 | Mostly |
| API3 | Broken object **property**-level authorization | `OASValidation` with `additionalProperties:false`; strip fields in responses (`AssignMessage`/JS) | [OpenAPI-first](openapi-first.md) | Partly |
| API4 | Unrestricted resource consumption | `SpikeArrest`, `Quota`, `ConcurrentRateLimit`, payload-size & pagination caps, timeouts | [Lab 4](../labs/traffic-management.md), [Access & routing](access-routing.md) | Largely |
| API5 | Broken function-level authorization | Scopes per operation, products limited to paths/verbs | [OAuth grants](oauth-grants.md) | Largely |
| API6 | Unrestricted access to sensitive business flows | Per-app/per-user quotas on specific flows, anti-automation (Advanced API Security, Cloud Armor) | [Platform](platform-ops.md) | Partly |
| API7 | Server-side request forgery (SSRF) | Never build `target.url`/callout URL from client input; allow-list targets | [Access & routing](access-routing.md) | Largely |
| API8 | Security misconfiguration | `apigeelint`, TLS verification, normalised errors (no stack traces), CORS allow-list, encrypted KVMs | [Advanced](../advanced.md) | Largely |
| API9 | Improper inventory management | One place for all APIs: products, API hub, versioning/deprecation (`Sunset` headers), analytics on old versions | [Advanced](../advanced.md#6-versioning-and-lifecycle) | Partly |
| API10 | Unsafe consumption of APIs | Verify and size-limit **responses** from third parties (threat protection, `OASValidation` on responses), timeouts on callouts | [Lab 5](../labs/mediation.md) | Partly |

## Worked example: hardening `GET /orders/{id}`

Weakest version: key check only. Stronger, in flow order:

1. `AccessControl` (if internal) → blocks outsiders cheaply.
2. `SpikeArrest` → stops floods.
3. `VerifyAPIKey` / `VerifyAccessToken` → authenticates (API2).
4. Scope or product path check → function-level auth (API5).
5. `Quota` per app → consumption (API4).
6. `OASValidation` → rejects malformed input (API3).
7. Pass `X-Authenticated-User` to the backend; **the backend** confirms this
   user may read *this* order (API1).
8. Response shaping removes fields the caller shouldn't see (API3).
9. FaultRules return uniform errors with no internals (API8).

!!! warning "The gateway is not the last line"
    Anything depending on *which object* or *which user* needs backend checks.
    Treat Apigee as a strong first layer, not a substitute.

## Experiments

1. Take the labs bundle and list which of steps 1–9 it already has.
2. Add the missing ones for `/orders/{id}` and re-run the smoke test.
3. Write a one-line threat for each OWASP item as it applies to *your* API.

## Check yourself

??? question "1. Why can't Apigee alone prevent BOLA?"
    BOLA is about whether *this user* may access *this object*; that data lives in
    the backend. The gateway can authenticate and forward identity but doesn't know
    ownership.

??? question "2. Which two policies most directly address unrestricted resource consumption?"
    `SpikeArrest` (rate) and `Quota` (allowance), plus size/pagination limits
    and timeouts.

??? question "3. How does a `target.url` built from a request header become SSRF?"
    An attacker supplies an internal address; your proxy then fetches it from
    inside the network. Resolve targets from an allow-list instead.
