import { ADMIN_ROLES, APPROVER_ROLES, type ApprovalStage } from "./constants";
import type { AuthUser, RequestAccessContext, StepAccessContext } from "./types";

export function isSuperAdmin(user: AuthUser) {
  return user.roleName === "Super Admin";
}

export function isAdminRole(user: AuthUser) {
  return ADMIN_ROLES.includes(user.roleName);
}

function matchScope(user: AuthUser, scopeType: string, ids: Record<string, string | null | undefined>) {
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
