import "dotenv/config";
import { z } from "zod";

const rawEnvSchema = z.object({
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  APP_AUTH_SECRET: z.string().min(32).optional(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32).optional(),
  GITHUB_APP_ID: z.string().min(1),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1),
  GITHUB_WEBHOOK_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  ),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  ASANA_CLIENT_ID: z.string().min(1),
  ASANA_CLIENT_SECRET: z.string().min(1),
  ASANA_REDIRECT_URI: z.string().url(),
  ROUTE53_HEALTH_CHECK_ID: z
    .string()
    .uuid()
    .default("5021ff48-e1e7-4f02-af89-28d54734cb06"),
  ROUTE53_METRICS_REGION: z.string().default("us-east-1"),
  REACHABILITY_CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  CLOUDFLARE_API_TOKEN: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  ),
  CLOUDFLARE_ZONE_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional()
  ),
  CLOUDFLARE_TRAFFIC_CACHE_TTL_SECONDS: z.coerce.number().default(3600)
});

const parsedEnv = rawEnvSchema.parse(process.env);
const appAuthSecret = parsedEnv.APP_AUTH_SECRET ?? parsedEnv.NEON_AUTH_COOKIE_SECRET;

if (!appAuthSecret) {
  throw new Error("APP_AUTH_SECRET or NEON_AUTH_COOKIE_SECRET must be configured");
}

export const env = {
  ...parsedEnv,
  APP_AUTH_SECRET: appAuthSecret
};
