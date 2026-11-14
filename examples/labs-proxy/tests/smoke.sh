#!/usr/bin/env bash
# Black-box smoke test against a deployed labs-proxy.
# Usage: APIGEE_HOST=eval-group.my-org.apigee.net APIKEY=... ./tests/smoke.sh
set -uo pipefail
: "${APIGEE_HOST:?export APIGEE_HOST}"
: "${APIKEY:?export APIKEY}"
BASE="https://$APIGEE_HOST/labs"
fail=0

check() {  # name expected_status curl-args...
  local name=$1 want=$2; shift 2
  local got; got=$(curl -s -o /dev/null -w '%{http_code}' "$@")
  if [[ "$got" == "$want" ]]; then echo "PASS  $name ($got)"; else echo "FAIL  $name: want $want got $got"; fail=1; fi
}

check "hello is open"            200 "$BASE/hello"
sleep 6   # SA-Global (12pm) allows ~1 request / 5 s
check "orders needs a key"       401 "$BASE/orders"
sleep 6
check "orders with key"          200 "$BASE/orders?apikey=$APIKEY"
sleep 6
check "missing customerId -> 400" 400 -X POST -H 'content-type: application/json' -d '{"item":"x"}' "$BASE/orders?apikey=$APIKEY"
sleep 6
check "CORS preflight"           204 -X OPTIONS -H 'Origin: https://myspa.example.com' "$BASE/orders"
exit $fail
