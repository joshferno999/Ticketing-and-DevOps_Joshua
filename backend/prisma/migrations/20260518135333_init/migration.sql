-- Legacy drift cleanup: index may exist on databases that applied assignee work out of order.
-- IF EXISTS keeps shadow-database replays and fresh installs from failing.
DROP INDEX IF EXISTS "Card_assigneeAppUserId_idx";
