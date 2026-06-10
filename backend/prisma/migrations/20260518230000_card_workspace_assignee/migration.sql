-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "asanaUserGid" TEXT;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN "assigneeAppUserId" TEXT;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_assigneeAppUserId_fkey" FOREIGN KEY ("assigneeAppUserId") REFERENCES "AppUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Card_assigneeAppUserId_idx" ON "Card"("assigneeAppUserId");
