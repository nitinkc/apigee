# Cheat Sheet

One page to keep open while you work. Everything here is explained in
[Core Concepts](concepts.md) and the labs.

## Execution order

```
Proxy Req:  PreFlow → matching Flow → PostFlow → RouteRule
Target Req: PreFlow → matching Flow → PostFlow → ► backend
Target Res: PreFlow → matching Flow → PostFlow
Proxy Res:  PreFlow → matching Flow → PostFlow → PostClientFlow (logging)
Fault:      FaultRules (first match) → DefaultFaultRule      [PostFlow skipped]
```

## Conditions

| Need | Write |
|---|---|
| exact verb | `request.verb = "GET"` |
| exact path | `proxy.pathsuffix MatchesPath "/orders"` |
| one segment | `proxy.pathsuffix MatchesPath "/orders/*"` |
| any depth | `proxy.pathsuffix MatchesPath "/orders/**"` |
| header present | `request.header.x-trace Exists` |
| regex on body | `request.content ~~ "(?s).*customerId.*"` |
| wildcard on fault | `fault.name Matches "*Token*"` |
| not | `!(...)` |
| status class | `response.status.code >= 500` |

## Variables you will use daily

| Variable | Meaning |
|---|---|
| `request.verb`, `request.uri`, `request.content` | method, URI, body |
| `request.header.<name>`, `request.queryparam.<name>` | input |
| `proxy.basepath`, `proxy.pathsuffix` | routing parts |
| `response.status.code`, `response.content`, `response.header.<name>` | output |
| `verifyapikey.<policy>.client_id` | the validated key |
| `developer.email`, `developer.app.name`, `apiproduct.name` | caller identity |
| `ratelimit.<policy>.allowed.count / used.count / available.count` | quota counters |
| `responsecache.<policy>.cachehit` | cache hit? |
| `jwt.<policy>.decoded.claim.<name>` | verified JWT claim |
| `urirequest.<name>` | captured path placeholders |
| `fault.name`, `error.status.code` | in fault rules |
| `private.<name>` | masked variables (required for signing keys) |

## Policy → what it produces / needs

| Policy | Typical position | Needs | Produces |
|---|---|---|---|
| `SpikeArrest` | PreFlow | – | `ratelimit.<p>.*` |
| `VerifyAPIKey` | start of protected flow | key variable | client_id, developer, app, product |
| `OAuthV2` | token flow / protected flow | credentials / bearer | token or app info |
| `VerifyJWT` | protected flow | token + key | `jwt.<p>.*` claims |
| `Quota` | after auth | `Identifier` var | `ratelimit.<p>.*` |
| `ExtractVariables` | request | message | your variables |
| `ServiceCallout` | request | – | `<responseVar>.content` |
| `ResponseCache` | lookup req + populate res | key fragments | `cachehit` |
| `JavaScript` | anywhere | variables | variables / message edits |
| `AssignMessage` | anywhere | – | edited message / vars |
| `RaiseFault` | conditional step | – | immediate response |
| `KeyValueMapOperations` | PreFlow | map name | variable per `Get` |
| `MessageLogging` | PostClientFlow | – | log entry |

## Attributes common to all policies

| Attribute / element | Effect |
|---|---|
| `name` | must equal file name and `<Step><Name>` |
| `enabled="false"` | policy is skipped |
| `continueOnError="true"` | failure doesn't enter fault handling |
| `<IgnoreUnresolvedVariables>` | `true` = missing variable → empty, not fault |
| `<DisplayName>` | label only |

## Fault names

| `fault.name` | From | Status |
|---|---|---|
| `FailedToResolveAPIKey`, `InvalidApiKey`, `InvalidApiKeyForGivenResource` | VerifyAPIKey | 401 |
| `InvalidAccessToken`, `access_token_expired` | OAuthV2 | 401 |
| `TokenExpired`, `InvalidSignature`, `InsufficientKeyLength` | VerifyJWT/GenerateJWT | 401 |
| `QuotaViolation` | Quota | 429 |
| `SpikeArrestViolation` | SpikeArrest | 429 |
| `ExecutionFailed` | JavaScript, ServiceCallout | 500 |
| `RaiseFault` | RaiseFault | whatever you set |

## apigeecli quick commands

```bash
export TOKEN=$(gcloud auth print-access-token)
apigeecli apis create bundle -o $ORG -e $ENV -n NAME -p apiproxy -t $TOKEN --ovr   # deploy
apigeecli apis listdeploy    -o $ORG -n NAME -t $TOKEN                              # status
apigeecli apis deploy        -o $ORG -e $ENV -n NAME -v REV -t $TOKEN               # pin revision
apigeecli products create    -o $ORG -n P --envs $ENV --proxies NAME --approval auto -t $TOKEN
apigeecli developers create  -o $ORG -n D -f F -l L --user U --email E -t $TOKEN
apigeecli apps create        -o $ORG -n A --email E --prods P -t $TOKEN
apigeecli kvms create        -o $ORG -e $ENV -n MAP -t $TOKEN
apigeecli kvms entries create -o $ORG -e $ENV -m MAP -k KEY -v VALUE -t $TOKEN
apigeecli targetservers create -o $ORG -e $ENV -n S --host H --port 443 --enable -t $TOKEN
```

## More policies at a glance

| Policy | One-liner |
|---|---|
| `AccessControl` | IP allow/deny, first match wins, `noRuleMatchAction` default |
| `OASValidation` | validate request/response vs OpenAPI 3; JSON bodies only |
| `PopulateCache` / `LookupCache` / `InvalidateCache` | explicit cache control with key + scope |
| `OAuthV2` ops | Generate{AccessToken,AuthorizationCode}, RefreshAccessToken, VerifyAccessToken, InvalidateToken |
| `FlowCallout` | call a shared flow |

## Units and gotchas

| Thing | Unit / rule |
|---|---|
| `OAuthV2 <ExpiresIn>` | **milliseconds** |
| `GenerateJWT <ExpiresIn>` | `10m`, `1h`, `30s`… |
| `SpikeArrest <Rate>` | `Nps` / `Npm` (smoothed) |
| `ServiceCallout <Timeout>`, `JavaScript timeLimit` | milliseconds |
| `ResponseCache <TimeoutInSec>` | seconds |
| HS256 secret | ≥ 32 bytes; ref variable must start with `private.` |
| KVM read cache | `ExpiryTimeInSecs` (lab: 300 s) |
| Conditions | case-sensitive |
| Flows | first match wins |
