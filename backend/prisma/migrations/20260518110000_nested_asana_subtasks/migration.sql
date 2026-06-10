-- AlterTable
ALTER TABLE "Card"
ADD COLUMN     "asanaParentTaskGid" TEXT,
ADD COLUMN     "asanaRootTaskGid" TEXT,
ADD COLUMN     "ancestryPath" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "nestingDepth" INTEGER NOT NULL DEFAULT 0;

-- Backfill existing cards as direct children of their board root task
UPDATE "Card"
SET
  "asanaParentTaskGid" = "Board"."asanaParentTaskGid",
  "asanaRootTaskGid" = "Board"."asanaParentTaskGid",
  "ancestryPath" = ARRAY[]::TEXT[]
FROM "Board"
WHERE "Card"."boardId" = "Board"."id";

-- Make new hierarchy columns required after backfill
ALTER TABLE "Card"
ALTER COLUMN "asanaParentTaskGid" SET NOT NULL,
ALTER COLUMN "asanaRootTaskGid" SET NOT NULL,
ALTER COLUMN "ancestryPath" SET NOT NULL;
