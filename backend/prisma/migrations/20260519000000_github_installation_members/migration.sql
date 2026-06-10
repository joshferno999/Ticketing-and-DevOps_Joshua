-- Allow multiple workspace users to share the same GitHub App installation (e.g. org-level install).

CREATE TABLE "GitHubInstallationMember" (
    "id" TEXT NOT NULL,
    "appUserId" TEXT NOT NULL,
    "githubInstallationDbId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubInstallationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GitHubInstallationMember_appUserId_githubInstallationDbId_key"
ON "GitHubInstallationMember"("appUserId", "githubInstallationDbId");

CREATE INDEX "GitHubInstallationMember_appUserId_idx" ON "GitHubInstallationMember"("appUserId");
CREATE INDEX "GitHubInstallationMember_githubInstallationDbId_idx" ON "GitHubInstallationMember"("githubInstallationDbId");

ALTER TABLE "GitHubInstallationMember" ADD CONSTRAINT "GitHubInstallationMember_appUserId_fkey"
FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitHubInstallationMember" ADD CONSTRAINT "GitHubInstallationMember_githubInstallationDbId_fkey"
FOREIGN KEY ("githubInstallationDbId") REFERENCES "GitHubInstallation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "GitHubInstallationMember" ("id", "appUserId", "githubInstallationDbId", "createdAt")
SELECT
    CONCAT('legacy-member-', installation."id"),
    installation."appUserId",
    installation."id",
    installation."createdAt"
FROM "GitHubInstallation" AS installation;
