# Deep Dive — Access Control, Routing & Protocol Patterns

!!! abstract "By the end you can..."
    - Allow/deny callers by IP with `AccessControl`.
    - Route requests dynamically to different backends.
    - Front a SOAP/XML service with a JSON API.
    - Handle pagination and large payloads sensibly.

## 1. IP allow/deny with `AccessControl`

```xml
<AccessControl name="AC-InternalOnly">
  <IPRules noRuleMatchAction="DENY"> <!-- (1)! -->
    <MatchRule action="ALLOW"> <!-- (2)! -->
      <SourceAddress mask="24">198.51.100.1</SourceAddress> <!-- (3)! -->
      <SourceAddress mask="32">203.0.113.10</SourceAddress>
    </MatchRule>
  </IPRules>
</AccessControl>
```

1. Default when **no rule matches**: `DENY` makes this an **allow-list**;
   `ALLOW` makes it a block-list.
2. Rules are evaluated in order; the **first match wins**.
3. `mask` is the CIDR prefix length: `24` = the whole `198.51.100.*` range,
   `32` = a single address (the default).

Where to attach: the **ProxyEndpoint PreFlow**, before authentication and
quota, so blocked callers cost almost nothing.

!!! warning "Which IP is it?"
    Behind a load balancer the TCP peer is the LB, not the client. Make sure
    the policy evaluates the real client address (via `X-Forwarded-For`, or a
    variable configured with `ClientIPVariable`). Variable-based evaluation
    fails loudly on malformed IPs; header parsing silently ignores junk, which
    is a bypass risk when `noRuleMatchAction` is `ALLOW`. For internet-scale
    filtering prefer **Cloud Armor** in front of Apigee.

Store ranges in a KVM and reference them as `{kvm.ip.value}` / mask
variables to change them without redeploying.

## 2. Dynamic routing

### Route by condition

```xml
<RouteRule name="to-v2"> <!-- (1)! -->
  <Condition>request.header.x-api-version = "2"</Condition>
  <TargetEndpoint>orders-v2</TargetEndpoint>
</RouteRule>
<RouteRule name="to-v1">
  <TargetEndpoint>orders-v1</TargetEndpoint> <!-- (2)! -->
</RouteRule>
```

1. First match wins — most specific first.
2. Unconditioned fallback, always last.

Each TargetEndpoint is its own file (`targets/orders-v1.xml`, …) so each can
have its own URL, TLS settings and flows.

### Compute the target at runtime

Set `target.url` in the TargetEndpoint request flow:

```xml
<AssignMessage name="AM-SetTarget">
  <AssignVariable>
    <Name>target.url</Name>
    <Template>https://{kvm.backend.host}/{request.header.x-tenant}/orders</Template> <!-- (1)! -->
  </AssignVariable>
  <IgnoreUnresolvedVariables>false</IgnoreUnresolvedVariables> <!-- (2)! -->
</AssignMessage>
```

1. Build the URL from config + request data.
2. Fail rather than call `https:///orders` if something is missing.

!!! danger "SSRF"
    Never build `target.url` from raw client input (a header or query value
    that is a full URL). Resolve it from an **allow-list** (KVM map of tenant →
    host). This is OWASP API7 — see [OWASP mapping](owasp.md).

By default the incoming path suffix is appended to the target URL; set the
`target.copy.pathsuffix` variable to `false` in the target request flow to
stop that.

## 3. SOAP / XML backends

Pattern: JSON in, XML to the backend, XML back, JSON out.

```text
POST /orders (JSON)
  → [request]  AssignMessage: build SOAP envelope (Payload with {vars})
               set Content-Type + SOAPAction header
  → backend (SOAP)
  → [response] XMLtoJSON (+ ExtractVariables / JS to drop envelope)
  → JSON to client
```

```xml
<AssignMessage name="AM-SoapEnvelope">
  <Set>
    <Verb>POST</Verb>
    <Headers>
      <Header name="Content-Type">text/xml; charset=utf-8</Header>
      <Header name="SOAPAction">urn:GetOrder</Header>
    </Headers>
    <Payload contentType="text/xml">
      <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
        <soapenv:Body>
          <GetOrder><Id>{urirequest.orderId}</Id></GetOrder>
        </soapenv:Body>
      </soapenv:Envelope>
    </Payload>
  </Set>
  <AssignTo>request</AssignTo>
</AssignMessage>
```

Use `XMLThreatProtection` on any XML you accept, and map SOAP faults to HTTP
errors in a FaultRule (`ErrorResponseCode` on the target) so clients don't
see a 200 with a fault body.

## 4. Pagination and large payloads

- **Pass through** `limit`/`cursor`/`page` query parameters — the backend owns
  pagination; the proxy shouldn't reimplement it.
- **Put limits on the proxy**: cap `limit` with a condition + `RaiseFault`
  (e.g. `request.queryparam.limit > 100` → 400) so one call can't ask for a
  million rows (OWASP API4).
- **Add navigation**: a small JS/AssignMessage step can set a `Link: <…>;
  rel="next"` header from the backend's cursor.
- **Large bodies**: by default Apigee buffers messages in memory. For big or
  streaming transfers enable streaming on the proxy/target (`request.streaming.enabled`
  / `response.streaming.enabled` properties) — but note that policies that need
  the body (JS, ExtractVariables on content, XMLtoJSON) can't run on a
  streamed message. Check the documented size limits for your Apigee edition.

## Experiments

1. Add an allow-list `AccessControl` with your own IP in `PreFlow`; test from a
   phone hotspot to see the deny.
2. Add `orders-v2` target (point it at `https://httpbin.org`) and a RouteRule
   keyed on `x-api-version`.
3. Add a flow that rejects `?limit=1000` with a 400 `RaiseFault`.

## Check yourself

??? question "1. `noRuleMatchAction=ALLOW` plus a DENY rule list: what is it, and what's the risk?"
    A block-list. Anything you forgot to list is allowed, and malformed
    header-derived IPs may match nothing and so be allowed.

??? question "2. Why must the unconditioned RouteRule be last?"
    Rules are evaluated in order; an unconditioned one matches everything, so
    anything after it never runs.

??? question "3. Where would you stop a client from supplying its own backend URL?"
    Never use client input as `target.url`; resolve a tenant/key to a host from
    a KVM allow-list.
