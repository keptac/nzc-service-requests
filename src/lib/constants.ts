export const ROLE_NAMES = [
  "Super Admin",
  "Union President",
  "Union Secretary",
  "Union Admin",
  "Conference President",
  "Conference Secretary",
  "Conference Admin",
  "Conference Pastor",
  "District Coordinator",
  "District Pastor",
  "Church Clerk",
  "Assistant Church Clerk",
  "Church Elder"
] as const;

export type RoleName = (typeof ROLE_NAMES)[number];

export const REQUEST_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "PENDING_DESTINATION_ACCEPTANCE",
  "PENDING_PASTOR_APPROVAL",
  "PENDING_CONFERENCE_APPROVAL",
  "PENDING_UNION_APPROVAL",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
  "RETURNED_FOR_CLARIFICATION"
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_DESTINATION_ACCEPTANCE: "Pending Destination Church Acceptance",
  PENDING_PASTOR_APPROVAL: "Pending District Pastor Approval",
  PENDING_CONFERENCE_APPROVAL: "Pending Conference Approval",
  PENDING_UNION_APPROVAL: "Pending Union Approval",
  APPROVED: "Approved",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  RETURNED_FOR_CLARIFICATION: "Returned for Clarification"
};

export const APPROVAL_STAGES = ["DESTINATION", "PASTOR", "CONFERENCE", "UNION"] as const;
export type ApprovalStage = (typeof APPROVAL_STAGES)[number];

export const STEP_STATUSES = ["PENDING", "APPROVED", "DECLINED", "RETURNED", "SKIPPED"] as const;
export type ApprovalStepStatus = (typeof STEP_STATUSES)[number];

export const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent"
};

export const SERVICE_REQUEST_TYPES = [
  "Music Group",
  "Preaching Assignment",
  "Training",
  "Other"
] as const;

export const STAGE_TO_STATUS: Record<ApprovalStage, RequestStatus> = {
  DESTINATION: "PENDING_DESTINATION_ACCEPTANCE",
  PASTOR: "PENDING_PASTOR_APPROVAL",
  CONFERENCE: "PENDING_CONFERENCE_APPROVAL",
  UNION: "PENDING_UNION_APPROVAL"
};

export const APPROVER_ROLES: Record<ApprovalStage, RoleName[]> = {
  DESTINATION: ["Church Clerk", "Assistant Church Clerk", "Church Elder"],
  PASTOR: ["District Pastor"],
  CONFERENCE: [
    "Conference President",
    "Conference Secretary",
    "Conference Admin",
    "Conference Pastor"
  ],
  UNION: ["Union President", "Union Secretary", "Union Admin"]
};

export const ADMIN_ROLES: RoleName[] = ["Super Admin", "Union Admin", "Conference Admin"];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
