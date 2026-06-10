-- Rename Board.appUserId to importedByAppUserId (workspace-global boards, audit trail only)
ALTER TABLE "Board" RENAME COLUMN "appUserId" TO "importedByAppUserId";

-- Rename FK constraint if it exists with default Prisma naming
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Board_appUserId_fkey'
  ) THEN
    ALTER TABLE "Board" RENAME CONSTRAINT "Board_appUserId_fkey" TO "Board_importedByAppUserId_fkey";
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Board_importedByAppUserId_idx" ON "Board"("importedByAppUserId");
