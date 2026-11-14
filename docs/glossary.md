# Glossary

| Term | Meaning |
|---|---|
| **Apigee X** | Google Cloud's managed API platform (the version these labs use) |
| **Organization (org)** | Top-level container; maps to a GCP project |
| **Environment** | Runtime sandbox (`dev`, `prod`, …) where revisions are deployed |
| **Environment group** | Hostnames that route traffic to attached environments |
| **API proxy** | Facade for a backend; defined by a bundle |
| **Bundle** | The `apiproxy/` folder of XML + resources |
| **Revision** | Immutable numbered snapshot of a bundle |
| **ProxyEndpoint** | Client-facing half: BasePath, flows, routing |
| **TargetEndpoint** | Backend-facing half: URL, TLS, flows |
| **Flow** | An ordered set of policy steps on a request/response pipeline |
| **PreFlow / PostFlow** | Unconditional first/last flow of an endpoint phase |
| **Conditional Flow** | A flow guarded by a `<Condition>`; first match wins |
| **PostClientFlow** | Response-only flow after the client has the response (logging) |
| **Step** | Reference to a policy by name inside a flow |
| **Policy** | A single-purpose configurable behaviour (one XML file) |
| **RouteRule** | Chooses the target (or none = edge-only) |
| **Edge-only (no-target) route** | A RouteRule with no `TargetEndpoint`; proxy answers itself |
| **FaultRule** | Error handler with a condition; first match wins |
| **DefaultFaultRule** | Fallback error handler |
| **Fault** | Error state raised when a policy fails or `RaiseFault` runs |
| **Flow variable** | Per-request named value read/written by policies |
| **Message processor (MP)** | Runtime node executing proxies; counters may be per-MP |
| **API product** | Bundle of proxies/paths + quota/scopes granted to apps |
| **Developer** | Owner of apps (person/team) |
| **App** | Holds credentials; attached to products |
| **Consumer key / secret** | An app's API key and secret (`client_id` / `client_secret`) |
| **Opaque token** | Random string validated by lookup in a token store |
| **JWT** | Signed, self-contained token: header.payload.signature |
| **JWKS** | JSON document of public keys for verifying JWT signatures |
| **HS256 / RS256** | HMAC (shared secret) vs RSA (key pair) JWT signing |
| **Client-credentials grant** | OAuth flow for app-to-API (no end user) |
| **Spike arrest** | Smooths traffic to a steady rate (protects backend) |
| **Quota** | Counts calls per identifier per time window (contract) |
| **Mediation** | Transforming/enriching messages in flight |
| **Service callout** | Blocking side request made by the proxy |
| **KVM** | Key-value map for config; scopes: org / env / proxy; optionally encrypted |
| **Target server** | Named backend host:port resolved per environment |
| **Shared flow** | Reusable policy sequence, invoked by `FlowCallout` |
| **Flow hook** | Shared flow auto-attached to all proxies in an env |
| **CORS** | Browser mechanism letting cross-origin scripts read API responses |
| **Preflight** | `OPTIONS` request a browser sends before a non-simple CORS call |
| **Debug / Trace** | Tool that records a transaction step by step |
| **apigeecli** | CLI for Apigee management APIs |
| **apigeelint** | Static analyser for bundles |
