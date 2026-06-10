#!/usr/bin/env bash
# Merge default / CI-provided keys into emergence-devops/backend so ECS task
# definitions can reference JSON keys that were added after initial bootstrap.
set -euo pipefail

SECRET_ID="${1:-emergence-devops/backend}"
AWS_CMD=(aws)
if [ -n "${AWS_PROFILE:-}" ]; then
  AWS_CMD=(aws --profile "$AWS_PROFILE")
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

secret_json="$("${AWS_CMD[@]}" secretsmanager get-secret-value \
  --secret-id "$SECRET_ID" \
  --query 'SecretString' \
  --output text)"

patch=$(echo "$secret_json" | jq -c '
  . + {
    CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS: (.CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS // "3600")
  }
')

if [ -n "${CLOUDFLARE_API_TOKEN:-}" ] && [ -n "${CLOUDFLARE_ZONE_ID:-}" ]; then
  patch=$(echo "$patch" | jq -c \
    --arg token "$CLOUDFLARE_API_TOKEN" \
    --arg zone "$CLOUDFLARE_ZONE_ID" \
    '. + {CLOUDFLARE_API_TOKEN: $token, CLOUDFLARE_ZONE_ID: $zone}')
fi

if [ "$secret_json" = "$patch" ]; then
  echo "Secret ${SECRET_ID} already up to date."
  exit 0
fi

echo "Updating ${SECRET_ID} with missing Cloudflare keys..."
"${AWS_CMD[@]}" secretsmanager put-secret-value \
  --secret-id "$SECRET_ID" \
  --secret-string "$patch"
echo "Done."
