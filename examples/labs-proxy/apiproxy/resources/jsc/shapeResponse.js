// Runs in the response flow for /orders and /orders/{id}.
// Wraps the upstream payload in an envelope and annotates cache/app/quota
// state so labs can observe flow variables in the response body.
var ctx = context;

var cacheHit = ctx.getVariable("responsecache.RC-Orders.cachehit");
var app      = ctx.getVariable("developer.app.name") || "anonymous";
var dev      = ctx.getVariable("developer.email") || "n/a";
var orderId  = ctx.getVariable("urirequest.orderId") || null;

var origin = null;
try {
  origin = JSON.parse(ctx.getVariable("ipResponse.content") || "{}").origin || null;
} catch (e) {}

var upstream = {};
try {
  upstream = JSON.parse(ctx.getVariable("response.content") || "{}");
} catch (e) {
  upstream = { raw: ctx.getVariable("response.content") };
}

var body;
if (cacheHit === true || cacheHit === "true") {
  // Cached payload is already shaped — just annotate it.
  upstream.cache = "hit (edge)";
  body = upstream;
} else {
  body = {
    message: orderId ? "order " + orderId : "orders list",
    app: app,
    developer: dev,
    orderId: orderId,
    quota: {
      allowed:   ctx.getVariable("ratelimit.Quota-PerApp.allowed.count"),
      used:      ctx.getVariable("ratelimit.Quota-PerApp.used.count"),
      available: ctx.getVariable("ratelimit.Quota-PerApp.available.count")
    },
    enrichedFrom: origin,
    upstream: upstream,
    cache: "miss (backend)"
  };
}

ctx.setVariable("response.content", JSON.stringify(body));
ctx.setVariable("response.header.content-type", "application/json");
print("JS-ShapeResponse cacheHit=" + cacheHit + " orderId=" + orderId);
