PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS "Role" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Role_name_key" ON "Role"("name");

CREATE TABLE IF NOT EXISTS "Union" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Union_code_key" ON "Union"("code");

CREATE TABLE IF NOT EXISTS "Conference" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "unionId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Conference_code_key" ON "Conference"("code");
CREATE INDEX IF NOT EXISTS "Conference_unionId_idx" ON "Conference"("unionId");

CREATE TABLE IF NOT EXISTS "District" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "conferenceId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "District_code_key" ON "District"("code");
CREATE INDEX IF NOT EXISTS "District_conferenceId_idx" ON "District"("conferenceId");

CREATE TABLE IF NOT EXISTS "Church" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "districtId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "Church_code_key" ON "Church"("code");
CREATE INDEX IF NOT EXISTS "Church_districtId_idx" ON "Church"("districtId");

CREATE TABLE IF NOT EXISTS "ServiceRequestType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequestType_name_key" ON "ServiceRequestType"("name");

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "preferred_language" TEXT NOT NULL DEFAULT 'en',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "roleId" TEXT NOT NULL,
  "unionId" TEXT,
  "conferenceId" TEXT,
  "districtId" TEXT,
  "churchId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_roleId_idx" ON "User"("roleId");
CREATE INDEX IF NOT EXISTS "User_unionId_idx" ON "User"("unionId");
CREATE INDEX IF NOT EXISTS "User_conferenceId_idx" ON "User"("conferenceId");
CREATE INDEX IF NOT EXISTS "User_districtId_idx" ON "User"("districtId");
CREATE INDEX IF NOT EXISTS "User_churchId_idx" ON "User"("churchId");

CREATE TABLE IF NOT EXISTS "ServiceRequest" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "typeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "requestingChurchId" TEXT NOT NULL,
  "targetChurchId" TEXT,
  "targetDistrictId" TEXT,
  "targetConferenceId" TEXT,
  "targetUnionId" TEXT,
  "proposedDate" DATETIME,
  "requiredToDate" DATETIME,
  "contactPerson" TEXT NOT NULL,
  "contactEmail" TEXT,
  "serviceRequired" TEXT,
  "presentationMethod" TEXT,
  "nameSuggested" TEXT,
  "fromWhere" TEXT,
  "whereRequired" TEXT,
  "boardActionNumber" TEXT,
  "expensesIncurredBy" TEXT,
  "clericalOfficeName" TEXT,
  "clericalOfficePhone" TEXT,
  "firstElderName" TEXT,
  "firstElderPhone" TEXT,
  "districtPastorName" TEXT,
  "districtPastorPhone" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "additionalNotes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentStepOrder" INTEGER,
  "requesterId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ServiceRequest_requestNumber_key" ON "ServiceRequest"("requestNumber");
CREATE INDEX IF NOT EXISTS "ServiceRequest_typeId_idx" ON "ServiceRequest"("typeId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_requestingChurchId_idx" ON "ServiceRequest"("requestingChurchId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_targetChurchId_idx" ON "ServiceRequest"("targetChurchId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_targetDistrictId_idx" ON "ServiceRequest"("targetDistrictId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_targetConferenceId_idx" ON "ServiceRequest"("targetConferenceId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_targetUnionId_idx" ON "ServiceRequest"("targetUnionId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_requesterId_idx" ON "ServiceRequest"("requesterId");
CREATE INDEX IF NOT EXISTS "ServiceRequest_status_idx" ON "ServiceRequest"("status");

CREATE TABLE IF NOT EXISTS "ApprovalStep" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "assignedRoleGroup" TEXT NOT NULL,
  "assignedScopeType" TEXT NOT NULL,
  "assignedChurchId" TEXT,
  "assignedDistrictId" TEXT,
  "assignedConferenceId" TEXT,
  "assignedUnionId" TEXT,
  "actedById" TEXT,
  "actedAt" DATETIME,
  "comment" TEXT,
  "minuteNumber" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "ApprovalStep_requestId_stepOrder_key" ON "ApprovalStep"("requestId", "stepOrder");
CREATE INDEX IF NOT EXISTS "ApprovalStep_stage_idx" ON "ApprovalStep"("stage");
CREATE INDEX IF NOT EXISTS "ApprovalStep_status_idx" ON "ApprovalStep"("status");
CREATE INDEX IF NOT EXISTS "ApprovalStep_assignedChurchId_idx" ON "ApprovalStep"("assignedChurchId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_assignedDistrictId_idx" ON "ApprovalStep"("assignedDistrictId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_assignedConferenceId_idx" ON "ApprovalStep"("assignedConferenceId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_assignedUnionId_idx" ON "ApprovalStep"("assignedUnionId");
CREATE INDEX IF NOT EXISTS "ApprovalStep_actedById_idx" ON "ApprovalStep"("actedById");

CREATE TABLE IF NOT EXISTS "Comment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "system" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Comment_requestId_idx" ON "Comment"("requestId");
CREATE INDEX IF NOT EXISTS "Comment_authorId_idx" ON "Comment"("authorId");

CREATE TABLE IF NOT EXISTS "Attachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "storedName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "url" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Attachment_requestId_idx" ON "Attachment"("requestId");
CREATE INDEX IF NOT EXISTS "Attachment_uploaderId_idx" ON "Attachment"("uploaderId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "actorId" TEXT,
  "requestId" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX IF NOT EXISTS "AuditLog_requestId_idx" ON "AuditLog"("requestId");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "requestId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_requestId_idx" ON "Notification"("requestId");
CREATE INDEX IF NOT EXISTS "Notification_readAt_idx" ON "Notification"("readAt");
