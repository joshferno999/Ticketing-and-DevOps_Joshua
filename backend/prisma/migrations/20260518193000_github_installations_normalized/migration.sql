CREATE TABLE "GitHubInstallation" (
    "id" TEXT NOT NULL,
    "githubInstallationId" BIGINT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "repositorySelection" TEXT NOT NULL,
    "settingsUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appUserId" TEXT NOT NULL,

    CONSTRAINT "GitHubInstallation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GitHubRepository" RENAME COLUMN "appUserId" TO "githubInstallationDbId";

ALTER TABLE "GitHubRepository" DROP CONSTRAINT "GitHubRepository_appUserId_fkey";
DROP INDEX "GitHubRepository_githubRepoId_key";
DROP INDEX "GitHubRepository_fullName_key";

ALTER TABLE "GitHubRepository" ALTER COLUMN "githubInstallationDbId" DROP NOT NULL;

CREATE UNIQUE INDEX "GitHubInstallation_githubInstallationId_key" ON "GitHubInstallation"("githubInstallationId");
CREATE INDEX "GitHubInstallation_appUserId_idx" ON "GitHubInstallation"("appUserId");
CREATE INDEX "GitHubRepository_fullName_idx" ON "GitHubRepository"("fullName");
CREATE UNIQUE INDEX "GitHubRepository_githubInstallationDbId_githubRepoId_key" ON "GitHubRepository"("githubInstallationDbId", "githubRepoId");

INSERT INTO "GitHubInstallation" (
    "id",
    "githubInstallationId",
    "accountLogin",
    "accountType",
    "targetType",
    "repositorySelection",
    "settingsUrl",
    "createdAt",
    "updatedAt",
    "appUserId"
)
SELECT
    CONCAT('legacy-installation-', "githubInstallationId"::text),
    "githubInstallationId",
    COALESCE("githubAccountLogin", 'unknown'),
    COALESCE("githubAccountType", 'Organization'),
    COALESCE("githubAccountType", 'Organization'),
    'all',
    NULL,
    "createdAt",
    "updatedAt",
    "id"
FROM "AppUser"
WHERE "githubInstallationId" IS NOT NULL;

UPDATE "GitHubRepository" AS repo
SET "githubInstallationDbId" = installation."id"
FROM "GitHubInstallation" AS installation
WHERE installation."appUserId" = repo."githubInstallationDbId";

DELETE FROM "GitHubRepository"
WHERE "githubInstallationDbId" IS NULL;

ALTER TABLE "GitHubRepository" ALTER COLUMN "githubInstallationDbId" SET NOT NULL;

ALTER TABLE "GitHubInstallation" ADD CONSTRAINT "GitHubInstallation_appUserId_fkey"
FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitHubRepository" ADD CONSTRAINT "GitHubRepository_githubInstallationDbId_fkey"
FOREIGN KEY ("githubInstallationDbId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
