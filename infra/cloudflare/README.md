# Cloudflare traffic (landing globe)

The landing globe **Traffic** mode reads zone HTTP request counts by country via the [Cloudflare GraphQL Analytics API](https://developers.cloudflare.com/analytics/graphql-api/).

## Required secrets

Add to `backend/.env` (local) and AWS Secrets Manager `emergence-devops/backend` (production):

| Key | Description |
|-----|-------------|
| `CLOUDFLARE_API_TOKEN` | API token with **Zone → Analytics → Read** for the target zone |
| `CLOUDFLARE_ZONE_ID` | Zone ID to query (your chosen zone) |
| `CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS` | Optional cache TTL (default `3600`) |

Sync local env to secrets JSON:

```bash
node infra/ecs/scripts/env-to-secrets-json.mjs
aws secretsmanager put-secret-value \
  --secret-id emergence-devops/backend \
  --secret-string file://infra/ecs/secrets.backend.json
```

Or patch only missing Cloudflare keys in the existing secret (fixes ECS `ResourceInitializationError` for `CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS`):

```bash
export AWS_PROFILE=emergence   # account that owns emergence-devops/backend
chmod +x infra/ecs/scripts/ensure-backend-secret-keys.sh
# Optional: also write API token + zone from backend/.env
export CLOUDFLARE_API_TOKEN=...
export CLOUDFLARE_ZONE_ID=...
./infra/ecs/scripts/ensure-backend-secret-keys.sh
```

After updating secrets, redeploy the backend ECS service (push to `main` or force-new-deployment).

**From GitHub:** run the **cloudflare-maintenance** workflow (Actions → cloudflare-maintenance → Run workflow). It syncs secrets and purges cache; deploy does not touch Cloudflare.

## Verify

```bash
curl -s http://localhost:4000/api/traffic/cloudflare | jq '.countries[:5]'
```

Production (after deploy):

```bash
curl -s https://devops.emsoft.com/api/traffic/cloudflare | jq '.countries[0]'
```

The API token is only used on the backend; it is never exposed to the browser.
