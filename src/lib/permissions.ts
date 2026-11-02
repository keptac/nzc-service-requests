import {
  ADMIN_ROLES,
  APPROVER_ROLES,
  HR_CONFIG_ROLES,
  HR_ROLES,
  type ApprovalStage
} from "./constants";
import type {
  AuthUser,
  LeaveAccessContext,
  RequestAccessContext,
  StepAccessContext
} from "./types";

export function isSuperAdmin(user: AuthUser) {
  return user.roleName === "Super Admin";
}

export function isAdminRole(user: AuthUser) {
  return ADMIN_ROLES.includes(user.roleName);
}

export function matchScope(
  user: AuthUser,
  scopeType: string,
  ids: Record<string, string | null | undefined>
) {
  if (isSuperAdmin(user)) return true;

  if (scopeType === "CHURCH") return Boolean(user.churchId && user.churchId === ids.churchId);
  if (scopeType === "DISTRICT") return Boolean(user.districtId && user.districtId === ids.districtId);
  if (scopeType === "CONFERENCE") {
    return Boolean(user.conferenceId && user.conferenceId === ids.conferenceId);
  }
  if (scopeType === "UNION") return Boolean(user.unionId && user.unionId === ids.unionId);
  return false;
}

export function canViewRequest(user: AuthUser, request: RequestAccessContext) {
  if (isSuperAdmin(user) || request.requesterId === user.id) return true;

  const requesting = request.requestingChurch;
  const targetChurch = request.targetChurch;

  const churchIds = [requesting.id, targetChurch?.id].filter(Boolean);
  if (user.churchId && churchIds.includes(user.churchId)) return true;

  const districtIds = [
    requesting.district.id,
    targetChurch?.district.id,
    request.targetDistrict?.id
  ].filter(Boolean);
  if (user.districtId && districtIds.includes(user.districtId)) return true;

  const conferenceIds = [
    requesting.district.conference.id,
    targetChurch?.district.conference.id,
    request.targetDistrict?.conference.id,
    request.targetConference?.id
  ].filter(Boolean);
  if (user.conferenceId && conferenceIds.includes(user.conferenceId)) return true;

  const unionIds = [
    requesting.district.conference.union.id,
    targetChurch?.district.conference.union.id,
    request.targetDistrict?.conference.unionId,
    request.targetConference?.unionId,
    request.targetUnion?.id
  ].filter(Boolean);
  return Boolean(user.unionId && unionIds.includes(user.unionId));
}

export function canAccessCreateRequest(user: AuthUser) {
  return isSuperAdmin(user) || (user.roleName === "Church Clerk" && Boolean(user.churchId));
}

export function canCreateRequest(user: AuthUser, requestingChurchId: string) {
  if (isSuperAdmin(user)) return Boolean(requestingChurchId);
  return canAccessCreateRequest(user) && user.churchId === requestingChurchId;
}

export function canComment(user: AuthUser, request: RequestAccessContext) {
  return canViewRequest(user, request);
}

export function canActOnStep(user: AuthUser, step: StepAccessContext) {
  if (step.status !== "PENDING") return false;
  if (isSuperAdmin(user)) return true;

  const allowedRoles = APPROVER_ROLES[step.stage as ApprovalStage] ?? [];
  if (!allowedRoles.includes(user.roleName)) return false;

  return matchScope(user, step.assignedScopeType, {
    churchId: step.assignedChurchId,
    districtId: step.assignedDistrictId,
    conferenceId: step.assignedConferenceId,
    unionId: step.assignedUnionId
  });
}

export function canEscalate(user: AuthUser, request: RequestAccessContext) {
  if (isSuperAdmin(user)) return true;

  const requesting = request.requestingChurch;

  if (user.roleName === "Union Admin") {
    return user.unionId === requesting.district.conference.union.id;
  }

  if (user.roleName === "Conference Admin") {
    return user.conferenceId === requesting.district.conference.id;
  }

  if (user.roleName === "District Coordinator") {
    return user.districtId === requesting.district.id;
  }

  return false;
}

export function canManageAdmin(user: AuthUser) {
  return isSuperAdmin(user);
}

export function canResubmit(user: AuthUser, request: RequestAccessContext, status: string) {
  return status === "RETURNED_FOR_CLARIFICATION" && request.requesterId === user.id;
}

export function canCancel(user: AuthUser, request: RequestAccessContext, status: string) {
  if (["APPROVED", "DECLINED", "CANCELLED"].includes(status)) return false;
  return isSuperAdmin(user) || request.requesterId === user.id;
}

// ---- HR / leave permissions ----

export function canAccessHr(user: AuthUser) {
  return HR_ROLES.includes(user.roleName);
}

// Configure employees, leave types, and balances.
export function canManageHrConfig(user: AuthUser) {
  return HR_CONFIG_ROLES.includes(user.roleName);
}

// Anyone with an active login can apply for leave (their own employee record).
export function canApplyForLeave(user: AuthUser) {
  return user.active;
}

// Which approval stage an application is currently waiting on.
export function leaveStage(status: string): "SUPERVISOR" | "ADCOM" | null {
  if (status === "SUBMITTED") return "SUPERVISOR";
  if (status === "RECOMMENDED") return "ADCOM";
  return null;
}

function matchesApproverScope(user: AuthUser, leave: LeaveAccessContext) {
  return matchScope(user, leave.approverScopeType, {
    churchId: leave.approverChurchId,
    districtId: leave.approverDistrictId,
    conferenceId: leave.approverConferenceId,
    unionId: leave.approverUnionId
  });
}

export function canViewLeave(user: AuthUser, leave: LeaveAccessContext) {
  if (canManageHrConfig(user)) return true;
  if (leave.employeeUserId && leave.employeeUserId === user.id) return true;
  if (leave.supervisorUserId && leave.supervisorUserId === user.id) return true;
  return matchesApproverScope(user, leave);
}

// Stage 1: the employee's supervisor recommends the application.
export function canSupervisorApproveLeave(user: AuthUser, leave: LeaveAccessContext) {
  if (leaveStage(leave.status) !== "SUPERVISOR") return false;
  // Applicants cannot recommend their own leave.
  if (leave.employeeUserId && leave.employeeUserId === user.id && !isSuperAdmin(user)) {
    return false;
  }
  if (canManageHrConfig(user)) return true;
  return Boolean(leave.supervisorUserId && leave.supervisorUserId === user.id);
}

// Stage 2: ADCOM records the minute number for final approval.
export function canAdcomApproveLeave(user: AuthUser, leave: LeaveAccessContext) {
  if (leaveStage(leave.status) !== "ADCOM") return false;
  if (leave.employeeUserId && leave.employeeUserId === user.id && !isSuperAdmin(user)) {
    return false;
  }
  if (canManageHrConfig(user)) return true;
  if (!canAccessHr(user)) return false;
  return matchesApproverScope(user, leave);
}

// Can the user act on whichever stage the application is currently in?
export function canApproveLeave(user: AuthUser, leave: LeaveAccessContext) {
  return canSupervisorApproveLeave(user, leave) || canAdcomApproveLeave(user, leave);
}

// The ADCOM minute number is only required at the final (ADCOM) stage.
export function leaveRequiresMinute(leave: LeaveAccessContext) {
  return leaveStage(leave.status) === "ADCOM";
}

export function canCancelLeave(user: AuthUser, leave: LeaveAccessContext) {
  if (["APPROVED", "DECLINED", "CANCELLED"].includes(leave.status)) return false;
  if (canManageHrConfig(user)) return true;
  return Boolean(leave.employeeUserId && leave.employeeUserId === user.id);
}
