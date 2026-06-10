#!/usr/bin/env node
/**
 * Reads backend/.env and writes infra/ecs/secrets.backend.json for ECS.
 * Usage: node infra/ecs/scripts/env-to-secrets-json.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envPath = resolve(root, "backend/.env");
const outPath = resolve(root, "infra/ecs/secrets.backend.json");

const APP_URL = process.env.APP_URL ?? "https://devops.emsoft.com";

function parseEnv(content) {
  const out = {};
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    i += 1;

    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && !value.endsWith('"')) ||
      (value.startsWith("'") && !value.endsWith("'"))
    ) {
      const quote = value[0];
      const parts = [value.slice(1)];
      while (i < lines.length) {
        const next = lines[i];
        i += 1;
        if (next.trim().endsWith(quote)) {
          parts.push(next.trim().slice(0, -1));
          break;
        }
        parts.push(next);
      }
      value = parts.join("\n");
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }

    out[key] = value.trim();
  }

  return out;
}

const raw = parseEnv(readFileSync(envPath, "utf8"));

const appAuthSecret =
  raw.APP_AUTH_SECRET ?? raw.NEON_AUTH_COOKIE_SECRET ?? raw.NEON_AUTH_COOKIE_SECRET;

if (!appAuthSecret || appAuthSecret.length < 32) {
  console.error("APP_AUTH_SECRET or NEON_AUTH_COOKIE_SECRET (32+ chars) required in backend/.env");
  process.exit(1);
}

const githubPrivateKey = raw.GITHUB_APP_PRIVATE_KEY ?? "";
if (!githubPrivateKey.includes("END RSA PRIVATE KEY") && !githubPrivateKey.includes("END PRIVATE KEY")) {
  console.error("GITHUB_APP_PRIVATE_KEY must be a full PEM (missing END line). Check backend/.env formatting.");
  process.exit(1);
}

const secrets = {
  PORT: raw.PORT ?? "4000",
  HOST: raw.HOST ?? "0.0.0.0",
  DATABASE_URL: raw.DATABASE_URL,
  FRONTEND_URL: raw.FRONTEND_URL ?? APP_URL,
  APP_AUTH_SECRET: appAuthSecret,
  GITHUB_APP_ID: raw.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: githubPrivateKey,
  GITHUB_CLIENT_ID: raw.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: raw.GITHUB_CLIENT_SECRET,
  ASANA_CLIENT_ID: raw.ASANA_CLIENT_ID,
  ASANA_CLIENT_SECRET: raw.ASANA_CLIENT_SECRET,
  ASANA_REDIRECT_URI: `${APP_URL}/api/integrations/asana/callback`,
  ROUTE53_HEALTH_CHECK_ID:
    raw.ROUTE53_HEALTH_CHECK_ID ?? "5021ff48-e1e7-4f02-af89-28d54734cb06",
  ROUTE53_METRICS_REGION: raw.ROUTE53_METRICS_REGION ?? "us-east-1",
  REACHABILITY_CACHE_TTL_SECONDS: raw.REACHABILITY_CACHE_TTL_SECONDS ?? "3600",
  AWS_REGION: raw.AWS_REGION ?? "us-east-1",
  CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS: raw.CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS ?? "3600"
};

if (raw.CLOUDFLARE_API_TOKEN?.trim()) {
  secrets.CLOUDFLARE_API_TOKEN = raw.CLOUDFLARE_API_TOKEN.trim();
}
if (raw.CLOUDFLARE_ZONE_ID?.trim()) {
  secrets.CLOUDFLARE_ZONE_ID = raw.CLOUDFLARE_ZONE_ID.trim();
}

if (raw.AWS_ACCESS_KEY_ID?.trim()) {
  secrets.AWS_ACCESS_KEY_ID = raw.AWS_ACCESS_KEY_ID.trim();
}
if (raw.AWS_SECRET_ACCESS_KEY?.trim()) {
  secrets.AWS_SECRET_ACCESS_KEY = raw.AWS_SECRET_ACCESS_KEY.trim();
}
if (raw.AWS_SESSION_TOKEN?.trim()) {
  secrets.AWS_SESSION_TOKEN = raw.AWS_SESSION_TOKEN.trim();
}

if (raw.GITHUB_WEBHOOK_SECRET?.trim()) {
  secrets.GITHUB_WEBHOOK_SECRET = raw.GITHUB_WEBHOOK_SECRET.trim();
}

for (const [key, value] of Object.entries(secrets)) {
  if (value === undefined || value === "") {
    console.error(`Missing required secret: ${key}`);
    process.exit(1);
  }
}

writeFileSync(outPath, `${JSON.stringify(secrets, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
