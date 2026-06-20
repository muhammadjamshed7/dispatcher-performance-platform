-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'TEAM_LEAD', 'DISPATCHER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'INACTIVE', 'INVITED');

-- CreateEnum
CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CarrierStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "LoadActivityStatus" AS ENUM ('DELIVERED', 'CANCELLED', 'NOT_BOOKED', 'NOT_WORKING');

-- CreateEnum
CREATE TYPE "TruckType" AS ENUM ('DRY_VAN', 'REEFER', 'FLATBED', 'BOX_TRUCK', 'HOTSHOT', 'POWER_ONLY', 'CARGO_VAN');

-- CreateEnum
CREATE TYPE "RegistrationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportExportStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_APPROVED', 'USER_REJECTED', 'USER_ROLE_ASSIGNED', 'USER_TEAM_ASSIGNED', 'TEAM_CREATED', 'TEAM_UPDATED', 'TEAM_DEACTIVATED', 'DISPATCHER_CREATED', 'DISPATCHER_UPDATED', 'DISPATCHER_DEACTIVATED', 'CARRIER_CREATED', 'CARRIER_UPDATED', 'CARRIER_DEACTIVATED', 'CARRIER_REASSIGNED', 'ACTIVITY_CREATED', 'ACTIVITY_UPDATED', 'SETTINGS_UPDATED', 'REPORT_EXPORTED');

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supabaseUserId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "teamId" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teamLeadUserId" TEXT,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispatcher" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Dispatcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "carrierName" TEXT NOT NULL,
    "driverName" TEXT NOT NULL,
    "mcNumber" TEXT NOT NULL,
    "truckType" "TruckType" NOT NULL,
    "teamId" TEXT NOT NULL,
    "dispatcherId" TEXT,
    "dispatchFeePercentage" DECIMAL(5,2) NOT NULL,
    "status" "CarrierStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarrierAssignmentHistory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "carrierId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "dispatcherId" TEXT,
    "teamNameSnapshot" TEXT NOT NULL,
    "dispatcherNameSnapshot" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "assignedByUserId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "CarrierAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyActivity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "activityDate" DATE NOT NULL,
    "carrierId" TEXT NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" "LoadActivityStatus" NOT NULL,
    "carrierNameSnapshot" TEXT NOT NULL,
    "driverNameSnapshot" TEXT NOT NULL,
    "dispatcherNameSnapshot" TEXT NOT NULL,
    "teamNameSnapshot" TEXT NOT NULL,
    "truckTypeSnapshot" "TruckType" NOT NULL,
    "dispatchFeePercentageSnapshot" DECIMAL(5,2) NOT NULL,
    "origin" TEXT,
    "destination" TEXT,
    "totalMiles" DECIMAL(10,2),
    "loadAmount" DECIMAL(12,2),
    "ratePerMile" DECIMAL(10,4),
    "dispatchFee" DECIMAL(12,2),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailySubmission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dispatcherId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "submissionDate" DATE NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "carrierCount" INTEGER NOT NULL DEFAULT 0,
    "activityCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DailySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatusReason" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StatusReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "dispatchFeeMethod" TEXT NOT NULL DEFAULT 'percentage',
    "defaultDispatchFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 12,
    "minimumDispatchFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "roundToNearestDollar" BOOLEAN NOT NULL DEFAULT true,
    "allowedTruckTypes" "TruckType"[],
    "timezone" TEXT NOT NULL DEFAULT 'America/Chicago',
    "csvIncludeHeaders" BOOLEAN NOT NULL DEFAULT true,
    "csvDateFormat" TEXT NOT NULL DEFAULT 'yyyy-MM-dd',
    "csvMaxRows" INTEGER NOT NULL DEFAULT 10000,
    "csvFileNamePrefix" TEXT NOT NULL DEFAULT 'dpp-report',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "requestedRole" "UserRole" NOT NULL DEFAULT 'DISPATCHER',
    "preferredTeamId" TEXT,
    "preferredTeamName" TEXT,
    "notes" TEXT,
    "status" "RegistrationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "rejectionReason" TEXT,
    "assignedTeamId" TEXT,
    "assignedRole" "UserRole",

    CONSTRAINT "RegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportExport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "status" "ReportExportStatus" NOT NULL DEFAULT 'PENDING',
    "fileName" TEXT,
    "rowCount" INTEGER,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ReportExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "Organization_deletedAt_idx" ON "Organization"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_supabaseUserId_key" ON "User"("supabaseUserId");

-- CreateIndex
CREATE INDEX "User_organizationId_role_status_idx" ON "User"("organizationId", "role", "status");

-- CreateIndex
CREATE INDEX "User_teamId_idx" ON "User"("teamId");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Team_organizationId_status_idx" ON "Team"("organizationId", "status");

-- CreateIndex
CREATE INDEX "Team_deletedAt_idx" ON "Team"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Team_organizationId_name_key" ON "Team"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Dispatcher_userId_key" ON "Dispatcher"("userId");

-- CreateIndex
CREATE INDEX "Dispatcher_organizationId_teamId_status_idx" ON "Dispatcher"("organizationId", "teamId", "status");

-- CreateIndex
CREATE INDEX "Dispatcher_deletedAt_idx" ON "Dispatcher"("deletedAt");

-- CreateIndex
CREATE INDEX "Carrier_organizationId_teamId_status_idx" ON "Carrier"("organizationId", "teamId", "status");

-- CreateIndex
CREATE INDEX "Carrier_dispatcherId_idx" ON "Carrier"("dispatcherId");

-- CreateIndex
CREATE INDEX "Carrier_deletedAt_idx" ON "Carrier"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Carrier_organizationId_mcNumber_key" ON "Carrier"("organizationId", "mcNumber");

-- CreateIndex
CREATE INDEX "CarrierAssignmentHistory_carrierId_assignedAt_idx" ON "CarrierAssignmentHistory"("carrierId", "assignedAt");

-- CreateIndex
CREATE INDEX "CarrierAssignmentHistory_organizationId_idx" ON "CarrierAssignmentHistory"("organizationId");

-- CreateIndex
CREATE INDEX "DailyActivity_organizationId_activityDate_idx" ON "DailyActivity"("organizationId", "activityDate");

-- CreateIndex
CREATE INDEX "DailyActivity_dispatcherId_activityDate_idx" ON "DailyActivity"("dispatcherId", "activityDate");

-- CreateIndex
CREATE INDEX "DailyActivity_teamId_activityDate_idx" ON "DailyActivity"("teamId", "activityDate");

-- CreateIndex
CREATE INDEX "DailyActivity_status_idx" ON "DailyActivity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DailyActivity_carrierId_activityDate_key" ON "DailyActivity"("carrierId", "activityDate");

-- CreateIndex
CREATE INDEX "DailySubmission_organizationId_submissionDate_idx" ON "DailySubmission"("organizationId", "submissionDate");

-- CreateIndex
CREATE INDEX "DailySubmission_teamId_submissionDate_idx" ON "DailySubmission"("teamId", "submissionDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailySubmission_dispatcherId_submissionDate_key" ON "DailySubmission"("dispatcherId", "submissionDate");

-- CreateIndex
CREATE INDEX "StatusReason_organizationId_isActive_idx" ON "StatusReason"("organizationId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StatusReason_organizationId_label_key" ON "StatusReason"("organizationId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE INDEX "RegistrationRequest_organizationId_status_submittedAt_idx" ON "RegistrationRequest"("organizationId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "RegistrationRequest_email_idx" ON "RegistrationRequest"("email");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ReportExport_organizationId_createdAt_idx" ON "ReportExport"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_teamLeadUserId_fkey" FOREIGN KEY ("teamLeadUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatcher" ADD CONSTRAINT "Dispatcher_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatcher" ADD CONSTRAINT "Dispatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispatcher" ADD CONSTRAINT "Dispatcher_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Carrier" ADD CONSTRAINT "Carrier_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "Dispatcher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAssignmentHistory" ADD CONSTRAINT "CarrierAssignmentHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAssignmentHistory" ADD CONSTRAINT "CarrierAssignmentHistory_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAssignmentHistory" ADD CONSTRAINT "CarrierAssignmentHistory_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAssignmentHistory" ADD CONSTRAINT "CarrierAssignmentHistory_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "Dispatcher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CarrierAssignmentHistory" ADD CONSTRAINT "CarrierAssignmentHistory_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "Dispatcher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyActivity" ADD CONSTRAINT "DailyActivity_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_dispatcherId_fkey" FOREIGN KEY ("dispatcherId") REFERENCES "Dispatcher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailySubmission" ADD CONSTRAINT "DailySubmission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatusReason" ADD CONSTRAINT "StatusReason_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSettings" ADD CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationRequest" ADD CONSTRAINT "RegistrationRequest_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportExport" ADD CONSTRAINT "ReportExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
