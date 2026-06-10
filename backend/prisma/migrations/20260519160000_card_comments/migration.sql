-- CreateTable
CREATE TABLE "CardComment" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "asanaStoryGid" TEXT NOT NULL,
    "asanaTaskGid" TEXT NOT NULL,
    "authorAppUserId" TEXT,
    "authorAsanaGid" TEXT,
    "authorName" TEXT NOT NULL,
    "htmlText" TEXT NOT NULL,
    "plainText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardComment_asanaStoryGid_key" ON "CardComment"("asanaStoryGid");

-- CreateIndex
CREATE INDEX "CardComment_cardId_createdAt_idx" ON "CardComment"("cardId", "createdAt");

-- AddForeignKey
ALTER TABLE "CardComment" ADD CONSTRAINT "CardComment_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardComment" ADD CONSTRAINT "CardComment_authorAppUserId_fkey" FOREIGN KEY ("authorAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
