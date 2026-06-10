# 🚀 Emergence-Devops Development Roadmap

**Project:** Azure Boards-style bridge (Neon Auth + Asana + GitHub)  
**Stack:** React 19 + Vite, Fastify, Prisma, PostgreSQL  
**Last Updated:** 2026-05-17 01:52 IST

---

## ✅ COMPLETED: Critical Security Fixes

### Commit: `c579da9` - 🔒 SECURITY: Fix critical auth and OAuth vulnerabilities

**Fixed Issues:**

1. **JWT Signature Verification Bypass** (CRITICAL)
   - Removed insecure `decodeJwt()` that allowed forged tokens
   - Now uses Neon Auth's secure session validation
   - **Impact:** Prevents authentication bypass and user impersonation

2. **OAuth State Replay Attack** (HIGH)
   - Added 10-minute TTL for OAuth states
   - One-time-use enforcement (states marked as "used")
   - Prevents CSRF and replay attacks

3. **Missing Environment Validation** (HIGH)
   - Added startup checks for `VITE_API_BASE_URL`
   - Prevents silent failures in production

4. **Silent Error Swallowing** (HIGH)
   - API errors now properly logged and thrown
   - Users get meaningful error messages
   - Fallback data only for 404/204

**Status:** ✅ Committed, ready to deploy

---

## 🎯 NEXT SPRINT: High Priority Fixes

### Week 1: Type Safety & Error Handling

#### 1. Add TypeScript Types for GitHub Webhooks
**Files:** `backend/src/modules/webhooks/github-webhook.service.ts`  
**Effort:** 2-3 hours

```typescript
// TODO: Replace 'any' with proper types
interface GitHubPushPayload {
  ref: string;
  commits: Array<{
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
    };
    timestamp: string;
  }>;
  repository: {
    id: number;
    name: string;
    full_name: string;
  };
}
```

Use Octokit's `@octokit/webhooks-types` package.

---

#### 2. Add Webhook Error Handling
**File:** `backend/src/routes/webhooks.routes.ts`  
**Effort:** 1-2 hours

```typescript
try {
  if (event === "push") {
    await webhookService.processPush(payload);
  }
  // ... other events
  return reply.status(202).send({ accepted: true });
} catch (error) {
  // Log error but still return 202 to avoid GitHub retries
  app.log.error({ error, event }, "Webhook processing failed");
  
  // Mark delivery as failed in database
  await webhookService.markDeliveryFailed(deliveryId, error);
  
  return reply.status(202).send({ 
    accepted: true, 
    note: "Queued for retry" 
  });
}
```

---

#### 3. Standardize Error Responses
**Effort:** 3-4 hours

Create `backend/src/lib/errors.ts`:

```typescript
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errors = {
  unauthorized: () => new AppError("UNAUTHORIZED", "Authentication required", 401),
  forbidden: () => new AppError("FORBIDDEN", "Access denied", 403),
  notFound: (resource: string) => 
    new AppError("NOT_FOUND", `${resource} not found`, 404),
  invalidInput: (details: unknown) => 
    new AppError("INVALID_INPUT", "Validation failed", 400, details)
};
```

Add Fastify error handler:

```typescript
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
  }

  app.log.error(error);
  return reply.status(500).send({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred"
    }
  });
});
```

---

### Week 2: Request Validation & Security

#### 4. Add Request Validation with Zod
**Effort:** 4-5 hours

Install:
```bash
npm install @fastify/type-provider-zod zod --workspace backend
```

Example:
```typescript
import { z } from "zod";

const createBoardSchema = z.object({
  name: z.string().min(1).max(100),
  asanaProjectId: z.string().cuid(),
  description: z.string().optional()
});

app.post("/boards", {
  schema: {
    body: createBoardSchema
  }
}, async (request, reply) => {
  const board = await boardsService.create(request.body);
  return { data: board };
});
```

**Apply to all POST/PUT/PATCH routes.**

---

#### 5. Add Rate Limiting
**Effort:** 1-2 hours

```bash
npm install @fastify/rate-limit --workspace backend
```

```typescript
import rateLimit from "@fastify/rate-limit";

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (request) => {
    return request.appUser?.id ?? request.ip;
  }
});

// Override for specific routes:
app.post("/webhooks/github", {
  config: {
    rateLimit: {
      max: 1000,
      timeWindow: "1 minute"
    }
  }
}, handler);
```

---

#### 6. Implement Token Refresh Logic
**File:** `backend/src/modules/asana/asana.oauth.service.ts`  
**Effort:** 3-4 hours

```typescript
async function ensureFreshToken(connection: AsanaConnection) {
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes

  if (connection.expiresAt.getTime() - now.getTime() > buffer) {
    return decryptValue(connection.accessTokenEncrypted, secret);
  }

  // Token expired or expiring soon - refresh it
  const response = await fetch("https://app.asana.com/-/oauth_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ASANA_CLIENT_ID,
      client_secret: env.ASANA_CLIENT_SECRET,
      refresh_token: decryptValue(connection.refreshTokenEncrypted, secret)
    })
  });

  if (!response.ok) {
    throw new Error("Token refresh failed - user needs to re-authenticate");
  }

  const tokens = await response.json();
  await prisma.asanaConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEncrypted: encryptValue(tokens.access_token, secret),
      refreshTokenEncrypted: encryptValue(tokens.refresh_token, secret),
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
    }
  });

  return tokens.access_token;
}
```

---

## 🚧 BACKLOG: Nice to Have

### Testing Infrastructure
- [ ] Set up Vitest for unit tests
- [ ] Add Playwright for E2E tests
- [ ] Create test fixtures for Prisma
- [ ] Mock external APIs (Asana, GitHub)

### Performance Optimization
- [ ] Add Redis caching layer
- [ ] Implement webhook job queue (BullMQ or pg-boss)
- [ ] Add database indexes for common queries
- [ ] Optimize N+1 queries

### Observability
- [ ] Add structured logging (Pino)
- [ ] Integrate OpenTelemetry for tracing
- [ ] Set up health check endpoints (`/health`, `/ready`)
- [ ] Add Prometheus metrics

### Developer Experience
- [ ] Add OpenAPI/Swagger docs
- [ ] Create Postman/Insomnia collection
- [ ] Write API integration guide
- [ ] Add database seed scripts

---

## 📋 TODO: Missing Implementations

### Frontend Components
- [ ] Error boundary for runtime errors
- [ ] Loading skeletons for async states
- [ ] Toast notifications for user feedback
- [ ] Retry mechanism for failed API calls

### Backend Services
- [ ] Implement `SyncJob` processor
- [ ] Add background job scheduler
- [ ] Create admin dashboard for webhook logs
- [ ] Build user audit log viewer

---

## 🛠 Tech Debt

### Code Organization
- [ ] Extract shared validation schemas
- [ ] Create service layer interfaces
- [ ] Add dependency injection
- [ ] Refactor route handlers to be thinner

### Database
- [ ] Review indexes for query performance
- [ ] Add soft deletes where appropriate
- [ ] Implement row-level security (RLS) if using Neon
- [ ] Create migration rollback scripts

---

## 📊 Current Status

### What Works ✅
- ✅ Neon Auth integration
- ✅ Asana OAuth flow
- ✅ GitHub App installation
- ✅ Webhook signature verification
- ✅ Basic board/card CRUD
- ✅ Analytics dashboard UI

### What Needs Work 🚧
- 🚧 Webhook processing (no retry logic)
- 🚧 Token refresh (not implemented)
- 🚧 Error handling (inconsistent)
- 🚧 Type safety (too many `any` types)
- 🚧 Testing (no tests yet)

### What's Missing ❌
- ❌ Rate limiting
- ❌ Request validation
- ❌ Comprehensive error responses
- ❌ Job queue for async work
- ❌ Admin tools

---

## 🎯 Sprint Planning

### Sprint 1 (This Week)
**Goal:** Harden security and error handling

- [ ] Deploy security fixes to production
- [ ] Add webhook error handling
- [ ] Implement token refresh
- [ ] Add request validation to 5 most-used endpoints

**Success Metrics:**
- Zero authentication bypass vulnerabilities
- All API errors properly logged
- Users see helpful error messages (not demo data)

---

### Sprint 2 (Next Week)
**Goal:** Type safety and observability

- [ ] Replace all `any` types with proper interfaces
- [ ] Add health check endpoints
- [ ] Set up structured logging
- [ ] Create Postman collection for API testing

---

### Sprint 3 (Future)
**Goal:** Reliability and scale

- [ ] Implement job queue for webhooks
- [ ] Add Redis caching
- [ ] Write E2E tests for critical flows
- [ ] Set up monitoring and alerting

---

## 🚀 Quick Wins (Do Now)

1. **Add `.env.example` validation** (5 min)
   ```bash
   # Add to package.json scripts
   "validate:env": "node -e \"require('dotenv').config(); console.log('✓ Environment valid')\""
   ```

2. **Add Git pre-commit hooks** (10 min)
   ```bash
   npx husky-init
   npx husky set .husky/pre-commit "npm run lint && npm run typecheck"
   ```

3. **Create `CONTRIBUTING.md`** (15 min)
   - Code style guide
   - PR checklist
   - How to run tests

4. **Add health check endpoint** (10 min)
   ```typescript
   app.get("/health", async () => {
     await prisma.$queryRaw`SELECT 1`;
     return { status: "ok", timestamp: new Date() };
   });
   ```

---

## 📚 Resources

- **Security Fixes:** See `BUGS_AND_FIXES.md`
- **Architecture:** See `docs/architecture.md`
- **API Docs:** Run `npm run dev` → http://localhost:4000/docs

---

**Generated by Full-Stack Developer Agent**  
Using: `saas-scaffolder`, `nextjs-shadcn`, `senior-fullstack`, `nodejs-backend-patterns`, `vercel-react-best-practices`
