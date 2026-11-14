# Deep Dive — OpenAPI-First Design & Validation

Design the contract first, then enforce it at the gateway. The OpenAPI
Specification (OAS) becomes the single source of truth for docs, mocks, client
SDKs, tests *and* runtime validation.

!!! abstract "By the end you can..."
    - Describe the `labs-proxy` API as an OpenAPI 3 document.
    - Reject non-conforming requests with `OASValidation`.
    - Know exactly what the policy does and does not validate.

## 1. A spec for the labs API

```yaml title="resources/oas/orders.yaml"
openapi: 3.0.3 # (1)!
info: { title: Labs Orders API, version: "1.0.0" }
servers:
  - url: https://{host}/labs # (2)!
    variables: { host: { default: eval-group.my-org.apigee.net } }
paths:
  /orders:
    get:
      operationId: listOrders # (3)!
      security: [{ apiKey: [] }]
      parameters:
        - { name: limit, in: query, schema: { type: integer, minimum: 1, maximum: 100 } } # (4)!
      responses:
        "200": { description: OK }
        "401": { $ref: "#/components/responses/Unauthorized" }
    post:
      operationId: createOrder
      security: [{ apiKey: [] }]
      requestBody:
        required: true # (5)!
        content:
          application/json:
            schema: { $ref: "#/components/schemas/NewOrder" }
      responses:
        "201": { description: Created }
        "400": { description: Invalid body }
components:
  securitySchemes:
    apiKey: { type: apiKey, in: query, name: apikey }
  schemas:
    NewOrder:
      type: object
      required: [customerId] # (6)!
      additionalProperties: false # (7)!
      properties:
        customerId: { type: string, minLength: 1 }
        item: { type: string, maxLength: 100 }
  responses:
    Unauthorized: { description: Missing or invalid credentials }
```

1. OAS **3.0** — what the Apigee validation policy supports.
2. The server URL (variables make it environment-neutral).
3. Stable identifier used by SDK generators and test names.
4. Constraints are *enforceable*: `limit` must be 1–100 — the same rule Lab-style
   pagination caps would otherwise implement by hand.
5. A missing body is an error, not an empty object.
6. This replaces the labs' hand-written regex check for `customerId`.
7. Unknown properties are rejected — blocks mass-assignment style abuse
   (OWASP API3).

## 2. Enforce it with `OASValidation`

Put the spec in the bundle at `apiproxy/resources/oas/orders.yaml` and attach:

```xml
<OASValidation name="OAS-Orders" continueOnError="false" enabled="true">
  <OASResource>oas://orders.yaml</OASResource> <!-- (1)! -->
  <Source>request</Source> <!-- (2)! -->
  <Options>
    <ValidateMessageBody>true</ValidateMessageBody> <!-- (3)! -->
    <AllowUnspecifiedParameters>
      <Header>true</Header> <!-- (4)! -->
      <Query>false</Query> <!-- (5)! -->
      <Cookie>false</Cookie>
    </AllowUnspecifiedParameters>
  </Options>
</OASValidation>
```

1. `oas://` points at `resources/oas/` inside the bundle (`.json`, `.yml`,
   `.yaml`).
2. Validate the incoming request. Use `response` to validate what the backend
   returned.
3. Check the body against the operation's schema. **Only `application/json`
   bodies are validated** — any other content type passes unchecked, so also
   restrict allowed `Content-Type` yourself.
4. Allow extra headers (clients, proxies and browsers add many).
5. Reject unknown query parameters — catches typos and probing.

Attach it early in the flow (PreFlow or the start of the specific flow), **after**
authentication but **before** `ExtractVariables`/JavaScript that parse the body.
Failures raise `policies.oasvalidation.Failed`, so give them a FaultRule:

```xml
<FaultRule name="oas-invalid">
  <Step><Name>AM-Error400</Name></Step>
  <Condition>fault.name = "Failed"</Condition>
</FaultRule>
```

The policy's error code is `policies.oasvalidation.Failed`; confirm the exact
`fault.name` in Debug for your version and match on that.

## 3. What it validates

| Part | Request validation |
|---|---|
| Base path | the **proxy's** base path (the spec's `servers` path is ignored) |
| Path | matches a path template in the spec |
| Verb | defined for that path |
| Body | schema validation if enabled and `Content-Type: application/json` |
| Parameters | required present, values match schema; optionally reject undeclared |

!!! warning "Response validation uses a different path"
    For **responses** the policy validates the *target's* path, not the proxy
    path. If your proxy path and backend path differ, align the spec to the
    one you're validating or response validation will fail unexpectedly.

!!! note "Not a replacement for authorisation"
    A schema says a body is *well-formed*, not that this caller may touch
    *this* object. Keep authorisation checks in the backend.

## 4. Other uses of the spec

- **Docs and portal:** publish it to the developer portal / API hub so docs
  stay accurate by construction.
- **Mocking:** serve examples from the spec (Prism, or an `AssignMessage` stub
  flow) so front-end work starts before the backend exists.
- **Contract testing:** generate request cases from the spec (see
  [Testing](testing.md)).
- **Linting:** run Spectral on the spec in CI to enforce naming and error
  conventions.

## Experiments

1. Add the spec and policy; send `POST /orders` with `{"item":"x"}` and with an
   extra field. Compare errors with the labs' `RF-MissingCustomer` approach.
2. Send `GET /orders?limit=1000` and `GET /orders?bogus=1`.
3. Send `POST` with `Content-Type: text/plain` and note what is *not* checked.

## Check yourself

??? question "1. Which content types does `ValidateMessageBody` actually validate?"
    Only `application/json`. Others pass without body validation.

??? question "2. Why put `additionalProperties: false` in a request schema?"
    To reject unexpected fields, which reduces mass-assignment and probing risk.

??? question "3. Your proxy base path is `/labs` but the backend serves `/api/orders`. What breaks response validation, and why?"
    Response validation uses the target path, so the spec must describe
    `/api/orders` for the response check to match.
