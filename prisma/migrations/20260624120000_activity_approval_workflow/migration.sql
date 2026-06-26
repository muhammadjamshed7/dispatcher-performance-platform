-- CreateEnum
CREATE TYPE "ActivityApprovalStatus" AS ENUM ('APPROVED', 'PENDING_TEAM_LEAD_APPROVAL', 'PENDING_ADMIN_APPROVAL', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVITY_SUBMITTED';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVITY_APPROVED_BY_TEAM_LEAD';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVITY_APPROVED_BY_ADMIN';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVITY_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVITY_PENDING_UPDATED';

-- AlterTable
ALTER TABLE "DailyActivity" ADD COLUMN     "approvalStatus" "ActivityApprovalStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN     "submittedById" TEXT,
ADD COLUMN     "teamLeadApprovedById" TEXT,
ADD COLUMN     "adminApprovedById" TEXT,
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "teamLeadApprovedAt" TIMESTAMP(3),
ADD COLUMN     "adminApprovedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN     "directAdminApprovalMode" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "DailyActivity_organizationId_approvalStatus_idx" ON "DailyActivity"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "DailyActivity_teamId_approvalStatus_idx" ON "DailyActivity"("teamId", "approvalStatus");
