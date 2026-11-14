#!/usr/bin/env bash
# Deploy the labs-proxy bundle + seed its KVM.
# Usage:
#   export APIGEE_ORG=my-org APIGEE_ENV=eval TOKEN=$(gcloud auth print-access-token)
#   ./deploy.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
: "${APIGEE_ORG:?export APIGEE_ORG first}"
APIGEE_ENV="${APIGEE_ENV:-eval}"
TOKEN="${TOKEN:-$(gcloud auth print-access-token)}"

echo "==> Seeding labs-config KVM in $APIGEE_ORG/$APIGEE_ENV"
apigeecli kvms create -o "$APIGEE_ORG" -e "$APIGEE_ENV" -n labs-config -t "$TOKEN" 2>/dev/null || true

seed() {  # create-or-update a KVM entry
  apigeecli kvms entries create -o "$APIGEE_ORG" -e "$APIGEE_ENV" -t "$TOKEN" \
    -m labs-config -k "$1" -v "$2" 2>/dev/null \
  || apigeecli kvms entries update -o "$APIGEE_ORG" -e "$APIGEE_ENV" -t "$TOKEN" \
    -m labs-config -k "$1" -v "$2" >/dev/null
}

seed cors.origin "https://myspa.example.com"
seed jwt.secret  "lab-secret-do-not-use-in-prod-0123456789"
seed cache.ttl   "60"

echo "==> Deploying labs-proxy (new revision, deployed in place)"
apigeecli apis create bundle \
  -o "$APIGEE_ORG" -e "$APIGEE_ENV" \
  --proxy-folder "$SCRIPT_DIR/apiproxy" \
  -n labs-proxy \
  -t "$TOKEN" --ovr

echo "==> Done. Try: curl https://<env-group-host>/labs/hello"
