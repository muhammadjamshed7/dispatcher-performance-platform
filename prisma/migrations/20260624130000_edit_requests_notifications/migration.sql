-- CreateEnum
CREATE TYPE "ActivityApprovalType" AS ENUM ('NEW_ACTIVITY', 'EDIT_ACTIVITY');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED', 'ADMIN_APPROVAL_REQUIRED', 'TEAM_LEAD_APPROVAL_REQUIRED', 'COMPLETED');

-- AlterTable
ALTER TABLE "DailyActivity" ADD COLUMN     "approvalNotes" TEXT,
ADD COLUMN     "approvalType" "ActivityApprovalType" NOT NULL DEFAULT 'NEW_ACTIVITY';

-- CreateTable
CREATE TABLE "ActivityEditRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "originalActivityId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "approvalStatus" "ActivityApprovalStatus" NOT NULL,
    "proposedChanges" JSONB NOT NULL,
    "previousData" JSONB NOT NULL,
    "submittedById" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "teamLeadApprovedById" TEXT,
    "adminApprovedById" TEXT,
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "approvalNotes" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamLeadApprovedAt" TIMESTAMP(3),
    "adminApprovedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityEditRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "notificationStatus" "NotificationStatus" NOT NULL,
    "activityId" TEXT,
    "editRequestId" TEXT,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEditRequest_organizationId_approvalStatus_idx" ON "ActivityEditRequest"("organizationId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ActivityEditRequest_originalActivityId_approvalStatus_idx" ON "ActivityEditRequest"("originalActivityId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ActivityEditRequest_teamId_approvalStatus_idx" ON "ActivityEditRequest"("teamId", "approvalStatus");

-- CreateIndex
CREATE INDEX "ActivityEditRequest_dispatcherId_approvalStatus_idx" ON "ActivityEditRequest"("dispatcherId", "approvalStatus");

-- CreateIndex
CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx" ON "Notification"("recipientUserId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityEditRequest" ADD CONSTRAINT "ActivityEditRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityEditRequest" ADD CONSTRAINT "ActivityEditRequest_originalActivityId_fkey" FOREIGN KEY ("originalActivityId") REFERENCES "DailyActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
