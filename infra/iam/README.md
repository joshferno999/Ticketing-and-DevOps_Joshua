# Route53 reachability (CloudWatch) IAM

The landing globe reads `AWS/Route53` → `TimeToFirstByte` for health check `webapp.emsoft.com` via `cloudwatch:GetMetricStatistics` in **us-east-1** (`ROUTE53_METRICS_REGION`).

## Credentials (no AWS profile)

The backend uses the SDK **default credential chain** — not `AWS_PROFILE` / `~/.aws/credentials` profiles.

| Variable | Purpose |
|----------|---------|
| `AWS_ACCESS_KEY_ID` | IAM access key |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key |
| `AWS_SESSION_TOKEN` | Optional, for temporary creds |
| `AWS_REGION` | General region (set `us-east-1`; CloudWatch Route53 metrics API also uses `ROUTE53_METRICS_REGION`) |

**Local:** add these to `backend/.env` (restart the server after changes).

**ECS:** either inject the same keys via Secrets Manager `emergence-devops/backend`, **or** omit keys and rely on the **task role** (recommended).

## ECS (production)

1. **Task role** `emergence-devops-ecs-task` with `cloudwatch:GetMetricStatistics`:

   ```bash
   export AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... AWS_REGION=us-east-1
   ./infra/iam/attach-reachability-policy.sh task-role
   ```

   Or re-run `./infra/ecs/bootstrap.sh`.

2. **Deploy backend** so `/api/reachability/latency` exists (404 = old image).

3. **Secrets** (if not using task role alone): add `ROUTE53_HEALTH_CHECK_ID`, `ROUTE53_METRICS_REGION`, `REACHABILITY_CACHE_TTL_SECONDS`, and optionally `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` to `emergence-devops/backend`.

Verify:

```bash
curl -s https://devops.emsoft.com/api/reachability/latency | jq '.probes[0]'
```

## Local development

1. Put IAM user keys for account **851725399092** in `backend/.env`:

   ```env
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   AWS_REGION=us-east-1
   ROUTE53_HEALTH_CHECK_ID=5021ff48-e1e7-4f02-af89-28d54734cb06
   ROUTE53_METRICS_REGION=us-east-1
   ```

2. Keys need `cloudwatch:GetMetricStatistics` (see [`reachability-cloudwatch-read.json`](reachability-cloudwatch-read.json)).

3. Restart backend, then:

   ```bash
   curl -s http://localhost:4000/api/reachability/latency | jq '.probes[] | {label, latencyMs}'
   ```

Shell `export AWS_DEFAULT_PROFILE=...` does **not** configure the Node process unless those values are also in `backend/.env` as env vars above.

Policy document: [`reachability-cloudwatch-read.json`](reachability-cloudwatch-read.json)
