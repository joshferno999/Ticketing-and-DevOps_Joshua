# Emergence-Devops - Bug Report & Development Plan

**Generated:** 2026-05-17 01:52 IST  
**Status:** Initial Analysis Complete

---

## 🚨 CRITICAL SECURITY ISSUES

### 1. **JWT Signature Not Verified** (CRITICAL)
**File:** `backend/src/modules/auth/auth.service.ts`  
**Line:** 47  
**Severity:** 🔴 CRITICAL

**Issue:**
```typescript
const payload = decodeJwt(authorization.replace("Bearer ", ""));
```

The `decodeJwt` function from `jose` only **decodes** the JWT without verifying the signature. This means anyone can forge a JWT token and authenticate as any user!

**Impact:**
- Complete authentication bypass
- Unauthorized access to all user data
- Ability to impersonate any user

**Fix Required:**
```typescript
import { jwtVerify } from "jose";

// Replace decodeJwt with jwtVerify
const { payload } = await jwtVerify(
  authorization.replace("Bearer ", ""),
  // Need to get the public key from Neon Auth
  await getPublicKey()
);
```

**Status:** ⏳ NEEDS IMMEDIATE FIX

---

### 2. **OAuth State Replay Vulnerability**
**File:** `backend/src/modules/asana/asana.oauth.service.ts`  
**Lines:** 88-97  
**Severity:** 🟠 HIGH

**Issue:**
The OAuth state validation doesn't:
1. Check if the state has expired (no TTL)
2. Ensure one-time use (state can be replayed)
3. Clean up used states

**Impact:**
- OAuth state can be replayed indefinitely
- CSRF protection is weakened
- Database bloat from unused audit events

**Fix Required:**
1. Add timestamp check (expire after 10 minutes)
2. Mark states as "used" after first validation
3. Add cleanup job for old states

**Status:** ⏳ NEEDS FIX

---

## 🐛 HIGH PRIORITY BUGS

### 3. **Missing Environment Variable Validation (Frontend)**
**File:** `frontend/src/lib/api.ts`  
**Line:** 3  
**Severity:** 🟠 HIGH

**Issue:**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
```

No validation if `VITE_API_BASE_URL` is defined. App will silently fail with `undefined` in API calls.

**Fix Required:**
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
if (!API_BASE_URL) {
  throw new Error("VITE_API_BASE_URL environment variable is not configured");
}
```

**Status:** ⏳ NEEDS FIX

---

### 4. **Silent Error Swallowing in API Client**
**File:** `frontend/src/lib/api.ts`  
**Lines:** 47-66  
**Severity:** 🟠 HIGH

**Issue:**
```typescript
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    // ... fetch logic
  } catch {
    return fallback;  // ⚠️ All errors silently swallowed!
  }
}
```

Network errors, server errors, parsing errors - everything is silently ignored and returns fallback data.

**Impact:**
- Users see demo/stale data instead of real errors
- Impossible to debug API issues
- No user feedback when backend is down

**Fix Required:**
1. Log errors to console (at minimum)
2. Throw errors for network/server failures
3. Only return fallback for 404 or empty responses
4. Add toast notifications for errors

**Status:** ⏳ NEEDS FIX

---

### 5. **Type Safety Issues - Excessive `any` Usage**
**Files:** 
- `backend/src/modules/webhooks/github-webhook.service.ts`
- `backend/src/routes/webhooks.routes.ts`

**Severity:** 🟡 MEDIUM

**Issue:**
GitHub webhook payloads typed as `any`:
```typescript
async function processPush(payload: any) {
  const commits = Array.isArray(payload.commits) ? payload.commits : [];
  // ...
}
```

**Impact:**
- No type safety
- Runtime errors if GitHub changes payload structure
- Difficult to refactor

**Fix Required:**
- Define proper TypeScript interfaces for GitHub webhook payloads
- Use Octokit's built-in types or create custom schemas
- Add runtime validation with Zod

**Status:** 📋 PLANNED

---

### 6. **Missing Error Handling in Webhook Processing**
**File:** `backend/src/routes/webhooks.routes.ts`  
**Lines:** 26-36  
**Severity:** 🟡 MEDIUM

**Issue:**
```typescript
if (event === "push") {
  await webhookService.processPush(payload);  // No error handling
}
```

If webhook processing fails, the entire request fails with 500. GitHub will retry indefinitely.

**Fix Required:**
1. Wrap webhook processing in try-catch
2. Always return 202 Accepted (even if processing fails)
3. Mark webhook delivery as "failed" in database
4. Implement retry queue for failed webhooks

**Status:** 📋 PLANNED

---

## 📝 CODE QUALITY ISSUES

### 7. **Inconsistent Error Responses**
**Severity:** 🟡 MEDIUM

Different endpoints return errors in different formats:
- Some throw errors
- Some return `{ error: "..." }`
- Some return fallback data

**Fix Required:**
- Standardize error response format across all endpoints
- Use Fastify error handler
- Create consistent error DTOs

**Status:** 📋 PLANNED

---

### 8. **Missing Request Validation**
**Severity:** 🟡 MEDIUM

Most routes don't validate request bodies or query parameters.

**Fix Required:**
- Add Zod schemas for all request bodies
- Use Fastify schema validation
- Return 400 errors with detailed validation messages

**Status:** 📋 PLANNED

---

### 9. **No Rate Limiting**
**Severity:** 🟡 MEDIUM

API has no rate limiting. Vulnerable to abuse.

**Fix Required:**
- Add `@fastify/rate-limit` plugin
- Configure per-user rate limits
- Add rate limit headers to responses

**Status:** 📋 PLANNED

---

## 🔧 MISSING FEATURES

### 10. **Token Refresh Logic Missing**
**File:** `backend/src/modules/asana/asana.oauth.service.ts`

The `AsanaConnection` table stores `expiresAt` but there's no logic to:
- Detect expired tokens
- Automatically refresh them
- Handle refresh failures

**Fix Required:**
Implement token refresh middleware/service.

**Status:** 📋 PLANNED

---

### 11. **No Webhook Retry Mechanism**
**File:** `backend/src/modules/webhooks/github-webhook.service.ts`

Failed webhooks are not retried.

**Fix Required:**
- Implement job queue (Bull, BullMQ, or pg-boss)
- Retry failed sync jobs with exponential backoff
- Add webhook delivery status dashboard

**Status:** 📋 PLANNED

---

### 12. **Missing Tests**
**Severity:** 🟡 MEDIUM

Package.json has test scripts but no actual tests exist.

**Fix Required:**
1. Add unit tests for services
2. Add integration tests for API endpoints
3. Add E2E tests for critical flows

**Status:** 📋 PLANNED

---

## 🎯 DEVELOPMENT PRIORITIES

### Phase 1: Security Fixes (IMMEDIATE)
- [ ] Fix JWT verification (#1) - **BLOCKING**
- [ ] Fix OAuth state replay (#2)
- [ ] Add environment validation (#3)

### Phase 2: Critical Bugs (THIS WEEK)
- [ ] Fix silent error swallowing (#4)
- [ ] Add webhook error handling (#6)
- [ ] Add proper TypeScript types (#5)

### Phase 3: Code Quality (NEXT SPRINT)
- [ ] Standardize error handling (#7)
- [ ] Add request validation (#8)
- [ ] Implement rate limiting (#9)
- [ ] Add token refresh logic (#10)

### Phase 4: Features & Testing (FUTURE)
- [ ] Implement webhook retry queue (#11)
- [ ] Write comprehensive tests (#12)
- [ ] Performance optimization
- [ ] Documentation

---

## 🚀 Next Steps

1. **Review this report** with the team
2. **Fix Critical Security Issues** (#1, #2) ASAP
3. **Deploy hotfix** for auth verification
4. **Create tickets** for remaining issues
5. **Set up CI/CD** to catch these issues earlier

---

**Generated by Full-Stack Developer Agent**  
Skills: `saas-scaffolder`, `nextjs-shadcn`, `senior-fullstack`
