-- CreateTable
CREATE TABLE "AppUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "asanaAccessTokenEncrypted" TEXT,
    "asanaRefreshTokenEncrypted" TEXT,
    "asanaTokenExpiresAt" TIMESTAMP(3),
    "githubAccessTokenEncrypted" TEXT,
    "githubRefreshTokenEncrypted" TEXT,
    "githubTokenExpiresAt" TIMESTAMP(3),
    "githubInstallationId" BIGINT,
    "githubAccountLogin" TEXT,
    "githubAccountType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appUserId" TEXT NOT NULL,

    CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubRepository" (
    "id" TEXT NOT NULL,
    "githubRepoId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBoardId" TEXT,
    "appUserId" TEXT NOT NULL,

    CONSTRAINT "GitHubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asanaParentTaskGid" TEXT NOT NULL,
    "asanaWorkspaceName" TEXT NOT NULL,
    "asanaProjectName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appUserId" TEXT NOT NULL,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardColumnMapping" (
    "id" TEXT NOT NULL,
    "columnKey" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "columnColor" TEXT NOT NULL,
    "asanaEnumOptionGid" TEXT,
    "boardId" TEXT NOT NULL,

    CONSTRAINT "BoardColumnMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "asanaTaskGid" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "statusKey" TEXT NOT NULL,
    "assigneeName" TEXT,
    "priority" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "boardId" TEXT NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentLink" (
    "id" TEXT NOT NULL,
    "linkType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sha" TEXT,
    "state" TEXT,
    "authorName" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "DevelopmentLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardStatusEvent" (
    "id" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cardId" TEXT NOT NULL,

    CONSTRAINT "CardStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT NOT NULL,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AppSession_tokenHash_key" ON "AppSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AppSession_appUserId_idx" ON "AppSession"("appUserId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubRepository_githubRepoId_key" ON "GitHubRepository"("githubRepoId");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubRepository_fullName_key" ON "GitHubRepository"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "Board_asanaParentTaskGid_key" ON "Board"("asanaParentTaskGid");

-- CreateIndex
CREATE UNIQUE INDEX "BoardColumnMapping_boardId_columnKey_key" ON "BoardColumnMapping"("boardId", "columnKey");

-- CreateIndex
CREATE UNIQUE INDEX "Card_asanaTaskGid_key" ON "Card"("asanaTaskGid");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDelivery_deliveryId_key" ON "WebhookDelivery"("deliveryId");

-- AddForeignKey
ALTER TABLE "AppSession" ADD CONSTRAINT "AppSession_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubRepository" ADD CONSTRAINT "GitHubRepository_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_appUserId_fkey" FOREIGN KEY ("appUserId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardColumnMapping" ADD CONSTRAINT "BoardColumnMapping_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentLink" ADD CONSTRAINT "DevelopmentLink_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardStatusEvent" ADD CONSTRAINT "CardStatusEvent_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "AppUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
