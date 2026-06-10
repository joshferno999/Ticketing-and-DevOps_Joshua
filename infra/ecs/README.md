# ECS deployment

Production URL: **https://devops.emsoft.com**

## Architecture

- **ALB** path routing: `/` → frontend (nginx :80), `/api/*` → backend (Fastify :4000)
- **ECS Fargate** cluster `emergence-devops`, two services
- **ECR** `emergence-devops-frontend`, `emergence-devops-backend`
- **Secrets Manager** `emergence-devops/backend` (JSON keys match `backend/.env.example`)

## Bootstrap (one-time)

```bash
export AWS_DEFAULT_PROFILE=emergence
export APP_URL=https://devops.emsoft.com
# Optional, after ACM validation in Cloudflare:
# export CERTIFICATE_ARN=arn:aws:acm:us-east-1:851725399092:certificate/...

cp infra/ecs/secrets.backend.example.json infra/ecs/secrets.backend.json
# Edit secrets.backend.json with real Neon, GitHub, Asana values

chmod +x infra/ecs/bootstrap.sh
./infra/ecs/bootstrap.sh
```

Outputs: `infra/ecs/.bootstrap-output.env` (includes `ALB_DNS` for your Cloudflare CNAME).

### Cloudflare DNS

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `devops` | ALB DNS from bootstrap output | Proxied (orange cloud) OK |

**Error 521 (web server is down)** — Cloudflare cannot reach the ALB. Common cause: SSL mode is **Full** or **Full (strict)** while the ALB only listens on HTTP port 80.

**Fix now (until ACM cert is on the ALB):**

1. Cloudflare → **SSL/TLS** → **Overview** → set encryption mode to **Flexible** (visitor HTTPS, origin HTTP on port 80).
2. Verify origin works: `curl http://<ALB_DNS>/api/health` should return `{"status":"ok","service":"backend"}`.

**Fix properly (HTTPS end-to-end):**

1. Add ACM validation CNAME in Cloudflare (**DNS only**, grey cloud):

   ```bash
   aws acm describe-certificate --certificate-arn <CERT_ARN> \
     --query 'Certificate.DomainValidationOptions[0].ResourceRecord' --output table
   ```

2. When status is `ISSUED`, run `AWS_PROFILE=emergence ./infra/ecs/enable-https.sh` (uses target groups `emergence-devops-fe-tg` / `emergence-devops-be-tg`).
3. Set Cloudflare SSL/TLS to **Full (strict)**.

## First image push

```bash
source infra/ecs/.bootstrap-output.env
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

docker build -f backend/Dockerfile -t emergence-devops-backend .
docker tag emergence-devops-backend:latest "$ECR_BACKEND"
docker push "$ECR_BACKEND"

docker build -f frontend/Dockerfile \
  --build-arg VITE_API_BASE_URL=https://devops.emsoft.com/api \
  -t emergence-devops-frontend .
docker tag emergence-devops-frontend:latest "$ECR_FRONTEND"
docker push "$ECR_FRONTEND"

aws ecs update-service --cluster emergence-devops --service emergence-devops-backend --force-new-deployment
aws ecs update-service --cluster emergence-devops --service emergence-devops-frontend --force-new-deployment
```

## GitHub App callback URL

After a user installs the GitHub App, GitHub redirects to the app **Setup URL** configured in the GitHub App settings. It must **not** point at `localhost` in production.

| Setting | Value |
|---------|--------|
| **Setup URL** (post-install redirect) | `https://devops.emsoft.com/api/integrations/github/setup` |

Also ensure Secrets Manager `emergence-devops/backend` has `FRONTEND_URL=https://devops.emsoft.com` (not `http://localhost:5173`).

The SPA at `https://devops.emsoft.com/` can still forward install callbacks if GitHub lands there, but the backend URL above is the recommended Setup URL.

## GitHub Actions

Repository secrets:

| Secret | Value |
|--------|--------|
| `AWS_ACCOUNT_ID` | `851725399092` |
| `AWS_ROLE_TO_ASSUME` | `arn:aws:iam::851725399092:role/emergence-devops-github-actions-deploy` |
| `CLOUDFLARE_API_TOKEN` | (optional) Used by **cloudflare-maintenance** workflow only |
| `CLOUDFLARE_ZONE_ID` | (optional) Used by **cloudflare-maintenance** workflow only |

Push to `main` runs typecheck, tests, Docker build/push, ECS task register/update, then waits for `https://devops.emsoft.com/api/health`. Deploy does **not** modify Secrets Manager or Cloudflare.

**Cloudflare (secrets + cache purge):** run the **cloudflare-maintenance** GitHub Actions workflow manually after setting repo secrets above, or locally:

```bash
export AWS_PROFILE=emergence
./infra/ecs/scripts/ensure-backend-secret-keys.sh
```

**ECS deploy fails with `did not contain json key CLOUDFLARE_*`:** add the missing keys via the script above (task definitions only reference keys that already exist in the secret).

**One-time IAM for manual secret sync from CI:** `chmod +x infra/iam/attach-github-actions-secrets-write.sh && ./infra/iam/attach-github-actions-secrets-write.sh`

### Blank page / MIME type error after deploy

Console error: *Expected a JavaScript module script but the server responded with MIME type "text/html"*.

**Cause:** Cloudflare (or the browser) cached an old `/assets/index-*.js` response as HTML from before nginx stopped SPA-fallback on missing assets. Stale `index.html` in the browser can keep requesting that old hash.

**Fix:**

1. Cloudflare → **Caching** → **Configuration** → **Purge Everything** for the zone (required once after the nginx fix).
2. In Chrome/Safari: hard refresh (`Cmd+Shift+R`) or clear site data for `devops.emsoft.com`.
3. Verify: `curl -sI https://devops.emsoft.com/assets/<hash-from-index.html>.js` must show `content-type: application/javascript`, not `text/html`.

Optional: add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` repo secrets so future deploys purge automatically.

## Migrations

```bash
# With DATABASE_URL in backend/.env or env:
npm run prisma:migrate --workspace backend
```

Use Neon direct (non-pooled) URL if migrations require it.

## Route53 reachability (landing globe)

Backend exposes `GET /api/reachability/latency` (public). Requires:

1. **Backend image** that includes the reachability module (deploy via CI or manual ECR push).
2. **ECS task role** `emergence-devops-ecs-task` with `cloudwatch:GetMetricStatistics` — run `./infra/iam/attach-reachability-policy.sh task-role` or re-run `bootstrap.sh`.
3. **Secrets** keys in `emergence-devops/backend`: `ROUTE53_HEALTH_CHECK_ID`, `ROUTE53_METRICS_REGION`, `REACHABILITY_CACHE_TTL_SECONDS`, `AWS_REGION` (see `secrets.backend.example.json`). Optional: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` if not using the task role alone.

Details: [`infra/iam/README.md`](../iam/README.md)

Cloudflare traffic (globe toggle): [`infra/cloudflare/README.md`](../cloudflare/README.md)

## Neon

- Runtime: pooled `DATABASE_URL` in Secrets Manager
- Migrations: direct URL when required
