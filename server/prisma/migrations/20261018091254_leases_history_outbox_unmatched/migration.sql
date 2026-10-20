-- AlterEnum
ALTER TYPE "PayStatus" ADD VALUE 'UNMATCHED';

-- DropIndex
DROP INDEX "Lease_tenantId_key";

-- DropIndex
DROP INDEX "Lease_unitId_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "shortcode" TEXT;

-- AlterTable
ALTER TABLE "ReminderLog" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'REMINDER',
ADD COLUMN     "landlordId" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'MOCK',
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");

-- CreateIndex
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");

-- CreateIndex
CREATE INDEX "ReminderLog_landlordId_sentAt_idx" ON "ReminderLog"("landlordId", "sentAt");

-- CreateIndex
CREATE INDEX "ReminderLog_tenantId_kind_sentAt_idx" ON "ReminderLog"("tenantId", "kind", "sentAt");
