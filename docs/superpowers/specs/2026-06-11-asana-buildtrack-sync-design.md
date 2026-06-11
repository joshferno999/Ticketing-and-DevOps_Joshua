# BuildTrack ↔ Asana Two-Way Sync

**Date:** 2026-06-11  
**Status:** Approved for implementation  
**Branch:** `emergence-devops-copy`

---

## Overview

BuildTrack tickets (requests) are currently managed entirely in the Emergence DevOps frontend. The team also maintains an Asana workspace where stakeholders and external PMs track work. This design connects the two systems so the dev team can work entirely out of DevOps — Asana becomes a live mirror that stakeholders can still view — with the long-term goal of phasing Asana out entirely.

---

## Chosen Approach

**Single project-level webhook on the Asana "Product Tickets" project.**

One webhook registered on the project fires for every task change inside it. The backend filters events by stored `asanaTaskGid` to route them to the correct BuildTrack ticket. This is simpler to manage than per-task webhooks and survives new tickets being added without re-registration.

---

## User Flow

1. PM/dev opens a BuildTrack ticket detail page (`/requests/:id`).
2. If the ticket has not been pushed yet, the "Push to Asana" button is active.
3. PM clicks "Push to Asana" → a task is created in the **"Product Tickets"** Asana project under the correct section (matching the ticket's current status).
4. The Asana task GID is stored on the ticket. The button changes to a link: "View in Asana ↗".
5. From this point on, changes in either system sync automatically:
   - Edit in DevOps → backend writes to DB and PATCHes the Asana task.
   - Edit in Asana → Asana fires the project webhook → backend updates the DB → frontend receives a live push.

---

## Architecture

```
DevOps Frontend
    │
    │  POST /api/buildtrack/tickets/:id/asana-push   (first push)
    │  PATCH /api/buildtrack/tickets/:id             (ongoing edits)
    ▼
Backend (Node / Fastify)
    │   AsanaSyncService
    │   ├─ createAsanaTask()         → Asana REST API
    │   ├─ updateAsanaTask()         → Asana REST API
    │   ├─ ensureProjectWebhook()    → Asana REST API (registers once)
    │   └─ handleWebhookEvent()      ← POST /api/webhooks/asana
    │
    ├─ Writes to:  BuildTicket table (Prisma)
    └─ Pushes to:  Frontend via SSE / WebSocket

Asana
    ├─ "Product Tickets" project
    │   ├─ Sections: Inbox | In Review | In Sprint | Done | Won't Fix
    │   └─ Custom fields: Priority, Type, Blocked, External ID (REQ-XXX)
    └─ Project webhook → POST /api/webhooks/asana
```

---

## Field Mapping

| BuildTrack Field | Direction | Asana Field | Mechanism |
|---|---|---|---|
| Title | ⇄ | Task name | Native — prefixed `[REQ-XXX] title` |
| Description | ⇄ | Task notes | Native — rich text via existing `asana-rich-text.ts` |
| Ticket ID | → | External ID custom field | Set on push; read-only in Asana |
| Status | ⇄ | Section in "Product Tickets" | Section move fires webhook → status update |
| Blocked | ⇄ | Blocked custom field (boolean) | Custom field — shown as flag on Asana card |
| Assignee | ⇄ | Assignee | Native — matched by `appUser.asanaUserGid` |
| Sponsor | → | Followers | Native — added as follower for notifications |
| Priority (P0–P3) | ⇄ | Priority custom field (enum) | Critical / High / Medium / Low |
| Type | → | Type custom field (enum) | Set on push; DevOps is source of truth |
| Product · Module | → | Tags | e.g. tag "DCC" + "Pipeline" |
| Due date | ⇄ | Due date | Native |
| Comments | ⇄ | Task stories | Stories API — author attributed by display name |

**Status → Section mapping:**

| BuildTrack Status | Asana Section |
|---|---|
| `submitted` | Inbox |
| `in_review` / `pending` | In Review |
| `in_sprint` / `in_progress` | In Sprint |
| `shipped` | Done |
| `wont_fix` / `next_phase` | Won't Fix |

---

## Backend Components

### 1. One-time setup script (`scripts/asana-setup.ts`)

Run once by a dev with Asana admin access. Creates:
- The **"Product Tickets"** Asana project in the workspace
- Five sections: Inbox, In Review, In Sprint, Done, Won't Fix
- Four custom fields on the project: External ID (text), Priority (enum), Type (enum), Blocked (boolean)
- Saves the project GID and custom field GIDs to the database (or `.env`) for use at runtime

### 2. `AsanaSyncService` (extends existing `asana.service.ts`)

New methods:

```typescript
createTicketInAsana(ticketId: string, userId: string): Promise<{ asanaTaskGid: string }>
updateAsanaTask(ticketId: string, patch: TicketPatch, userId: string): Promise<void>
ensureProjectWebhook(userId: string): Promise<void>   // idempotent — only registers if missing
```

`createTicketInAsana`:
1. Fetches BuildTrack ticket from DB
2. Creates Asana task via REST API with all mapped fields
3. Moves task to correct section based on current status
4. Stores `asanaTaskGid` on the ticket record
5. Calls `ensureProjectWebhook()`

### 3. Webhook handler (`/api/webhooks/asana`)

New Fastify route alongside the existing GitHub webhook handler.

```
POST /api/webhooks/asana
  1. Verify X-Hook-Signature (HMAC-SHA256, Asana signs with a secret returned at webhook registration)
  2. Handle handshake: if X-Hook-Secret header present, echo it back (Asana's registration flow)
  3. Parse events array
  4. For each event:
     a. Look up BuildTicket by asanaTaskGid
     b. If not found, skip (not a BuildTrack ticket)
     c. Map changed fields back to BuildTrack schema
     d. Write to DB (with source="asana" flag to suppress echo)
     e. Push update to any open frontend connections via SSE
```

**Echo loop prevention:** When the backend writes a change to Asana, it sets a short-lived Redis/in-memory flag (`syncing:{asanaTaskGid}`). If a webhook arrives while that flag is set, it is dropped. Flag TTL: 5 seconds.

### 4. Ticket PATCH endpoint updates

When `PATCH /api/buildtrack/tickets/:id` is called and the ticket has an `asanaTaskGid`, the handler calls `updateAsanaTask()` after writing to DB. Runs async — does not block the response.

### 5. Database schema additions (`BuildTicket` model)

```prisma
model BuildTicket {
  // ... existing fields ...
  asanaTaskGid      String?   // set after first push to Asana
  asanaSyncedAt     DateTime? // last successful sync timestamp
  asanaSyncError    String?   // last sync error message, if any
}
```

---

## Frontend Changes

### Ticket detail page (`/requests/:id`)

**Before push:**
```
[ Push to Asana ↑ ]    ← active button
```

**After push:**
```
[ ✓ Synced with Asana  View ↗ ]   ← link to Asana task
  Last synced: 2 minutes ago
```

**If sync error:**
```
[ ⚠ Sync error — Retry ]
  "Could not reach Asana. Changes will retry automatically."
```

**Live indicator:** A subtle animated dot on the Asana row pulses green when a webhook update arrives (same pattern as the existing board card live indicator).

---

## Error Handling

| Scenario | Handling |
|---|---|
| Asana API down during push | Return error to frontend, do not store GID. User can retry. |
| Webhook delivery fails | Asana retries for 24h with exponential backoff — no action needed |
| Webhook secret lost (backend redeploy) | Re-register webhook via `ensureProjectWebhook()` on next push or via admin endpoint |
| User's Asana token expired | Existing `ensureFreshConnectionForUser()` handles token refresh automatically |
| Field mismatch (unknown status value) | Log warning, fall back to "Inbox" section, don't crash |

---

## Setup Sequence (for the dev team)

1. Run `npx ts-node scripts/asana-setup.ts` with an Asana admin token → creates "Product Tickets" project, sections, custom fields
2. Copy the returned project GID and custom field GIDs into `.env` as:
   ```
   ASANA_PRODUCT_TICKETS_PROJECT_GID=xxxx
   ASANA_CUSTOM_FIELD_PRIORITY_GID=xxxx
   ASANA_CUSTOM_FIELD_TYPE_GID=xxxx
   ASANA_CUSTOM_FIELD_BLOCKED_GID=xxxx
   ASANA_CUSTOM_FIELD_EXTERNAL_ID_GID=xxxx
   ```
3. Run `npx prisma migrate dev` to add `asanaTaskGid`, `asanaSyncedAt`, `asanaSyncError` to `BuildTicket`
4. Deploy backend — the webhook endpoint is now live
5. First "Push to Asana" click on any ticket will auto-register the project webhook

---

## Out of Scope (this phase)

- Bulk sync of all existing tickets to Asana (can be a follow-up migration script)
- Deleting an Asana task when a BuildTrack ticket is deleted
- Asana subtasks (BuildTrack has no sub-ticket concept yet)
- Notifications / Slack alerts when Asana sync fails

---

## Integration Notes for Dev Team

- The existing `asana.service.ts` already handles OAuth, token refresh, and the Asana client factory — `AsanaSyncService` extends it rather than replacing it
- The existing `asana-rich-text.ts` in both frontend and backend handles description serialisation — reuse as-is
- The webhook route follows the same pattern as `github-webhook.service.ts`
- All BuildTrack API endpoints currently return 501 — the sync service is additive; wire it in when the BuildTrack API endpoints are implemented
