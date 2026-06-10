ALTER TABLE "Board"
ADD COLUMN "isStarred" BOOLEAN NOT NULL DEFAULT false;

WITH first_board AS (
  SELECT "id"
  FROM "Board"
  ORDER BY "createdAt" ASC, "id" ASC
  LIMIT 1
)
UPDATE "Board"
SET "isStarred" = true
WHERE "id" IN (SELECT "id" FROM first_board);
