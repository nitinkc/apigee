# labs-proxy — deployable example bundle

The complete proxy used by every lab in this site's docs. One proxy, base
path `/labs`, progressively exercising security, traffic management,
mediation, caching, fault handling, and CORS/KVM.

## Endpoints

| Path | Auth | Lab |
|---|---|---|
| `GET /labs/hello` | none | Lab 1 — edge-generated response |
| `POST /labs/token` | client credentials | Lab 3A — OAuthV2 token issuance |
| `POST /labs/jwt-mint` | none | Lab 3B — mint a lab JWT |
| `GET /labs/jwt-protected` | `Bearer <jwt>` | Lab 3B — VerifyJWT |
| `GET /labs/secure` | `Bearer <oauth token>` | Lab 3A — VerifyAccessToken |
| `GET /labs/orders` | `?apikey=` | Labs 2/4/6 — key, quota, cache |
| `GET /labs/orders/{id}` | `?apikey=` | Lab 5 — extract + service callout |
| `POST /labs/orders` | `?apikey=` | Lab 6 — RaiseFault validation |
| `OPTIONS /labs/*` | none | Lab 7 — CORS preflight |

## Deploy

```bash
export APIGEE_ORG=my-org APIGEE_ENV=eval
export TOKEN=$(gcloud auth print-access-token)
./deploy.sh        # seeds the labs-config KVM, then deploys the bundle
```

Backend is `mocktarget.apigee.net` — swap `apiproxy/targets/default.xml` for
your own service when you outgrow it.
