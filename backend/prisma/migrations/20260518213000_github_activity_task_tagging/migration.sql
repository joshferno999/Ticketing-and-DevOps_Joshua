CREATE TABLE "GitHubActivity" (
    "id" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" TEXT,
    "sha" TEXT,
    "pullRequestNumber" INTEGER,
    "branchName" TEXT,
    "authorName" TEXT NOT NULL,
    "authorLogin" TEXT,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "repositoryId" TEXT NOT NULL,

    CONSTRAINT "GitHubActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GitHubActivityTaskLink" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activityId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "GitHubActivityTaskLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GitHubActivity_repositoryId_activityType_idx" ON "GitHubActivity"("repositoryId", "activityType");
CREATE UNIQUE INDEX "GitHubActivity_repositoryId_sha_key" ON "GitHubActivity"("repositoryId", "sha");
CREATE UNIQUE INDEX "GitHubActivity_repositoryId_pullRequestNumber_key" ON "GitHubActivity"("repositoryId", "pullRequestNumber");
CREATE UNIQUE INDEX "GitHubActivityTaskLink_activityId_cardId_key" ON "GitHubActivityTaskLink"("activityId", "cardId");
CREATE INDEX "GitHubActivityTaskLink_cardId_idx" ON "GitHubActivityTaskLink"("cardId");

ALTER TABLE "GitHubActivity" ADD CONSTRAINT "GitHubActivity_repositoryId_fkey"
FOREIGN KEY ("repositoryId") REFERENCES "GitHubRepository"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitHubActivityTaskLink" ADD CONSTRAINT "GitHubActivityTaskLink_activityId_fkey"
FOREIGN KEY ("activityId") REFERENCES "GitHubActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GitHubActivityTaskLink" ADD CONSTRAINT "GitHubActivityTaskLink_cardId_fkey"
FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
