-- Restore assignee index dropped by 20260518135333_init when applied after assignee column migration.
CREATE INDEX IF NOT EXISTS "Card_assigneeAppUserId_idx" ON "Card"("assigneeAppUserId");
