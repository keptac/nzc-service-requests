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
  "Church Elder",
  "HR Manager"
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

export const HR_ROLES: RoleName[] = [
  "Super Admin",
  "HR Manager",
  "Union Admin",
  "Conference Admin",
  "District Coordinator"
];

// Roles allowed to configure HR entities (employees, leave types) and adjust balances.
export const HR_CONFIG_ROLES: RoleName[] = ["Super Admin", "HR Manager"];

export const LEAVE_STATUSES = [
  "SUBMITTED",
  "RECOMMENDED",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
  "RETURNED"
] as const;

export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  SUBMITTED: "Awaiting Supervisor",
  RECOMMENDED: "Recommended",
  APPROVED: "Approved",
  DECLINED: "Declined",
  CANCELLED: "Cancelled",
  RETURNED: "Returned for Clarification"
};

export const LEAVE_SCOPE_TYPES = ["CHURCH", "DISTRICT", "CONFERENCE", "UNION"] as const;
export type LeaveScopeType = (typeof LEAVE_SCOPE_TYPES)[number];

export const EMPLOYMENT_TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "VOLUNTEER"] as const;
export const EMPLOYEE_STATUSES = ["ACTIVE", "INACTIVE", "ON_LEAVE", "TERMINATED"] as const;

// Every employee accrues annual leave at this rate (days per month → 30/year).
export const MONTHLY_LEAVE_ACCRUAL_RATE = 2.5;

// Default leave types seeded by bootstrap; entitlement in days per year.
// `monthlyAccrualRate` (when set) makes the yearly balance accrue per month.
export const DEFAULT_LEAVE_TYPES: Array<{
  name: string;
  code: string;
  defaultAnnualDays: number;
  monthlyAccrualRate: number | null;
  paid: boolean;
}> = [
  {
    name: "Annual Leave",
    code: "ANNUAL",
    defaultAnnualDays: 30,
    monthlyAccrualRate: MONTHLY_LEAVE_ACCRUAL_RATE,
    paid: true
  },
  { name: "Sick Leave", code: "SICK", defaultAnnualDays: 12, monthlyAccrualRate: null, paid: true },
  { name: "Compassionate Leave", code: "COMPASSIONATE", defaultAnnualDays: 5, monthlyAccrualRate: null, paid: true },
  { name: "Maternity Leave", code: "MATERNITY", defaultAnnualDays: 98, monthlyAccrualRate: null, paid: true },
  { name: "Study Leave", code: "STUDY", defaultAnnualDays: 10, monthlyAccrualRate: null, paid: true },
  { name: "Unpaid Leave", code: "UNPAID", defaultAnnualDays: 0, monthlyAccrualRate: null, paid: false }
];

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
