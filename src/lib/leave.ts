import { prisma } from "./prisma";
import { canApproveLeave, canViewLeave, isSuperAdmin } from "./permissions";
import type { AuthUser, LeaveAccessContext } from "./types";
import type { LeaveScopeType } from "./constants";

export const leaveApplicationInclude = {
  leaveType: true,
  employee: {
    include: {
      user: { include: { role: true } }
    }
  },
  decidedBy: { include: { role: true } }
};

export type EmployeeScope = {
  unionId?: string | null;
  conferenceId?: string | null;
  districtId?: string | null;
  churchId?: string | null;
};

export type ResolvedApproverScope = {
  approverScopeType: LeaveScopeType;
  approverUnionId: string | null;
  approverConferenceId: string | null;
  approverDistrictId: string | null;
  approverChurchId: string | null;
};

/**
 * Count inclusive calendar days between two dates. Returns 0 when the range is
 * invalid. Weekend handling can be layered on later via leave-type config.
 */
export function countLeaveDays(start: Date | string, end: Date | string) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  const diff = endDate.getTime() - startDate.getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

/**
 * Route a leave application up the hierarchy. Church-level staff are reviewed by
 * their conference, anyone scoped at district level by their conference, and
 * conference/union staff at their union. Falls back to the narrowest scope that
 * is filled so unscoped employees are reviewed centrally (UNION/null).
 */
export function resolveApproverScope(employee: EmployeeScope): ResolvedApproverScope {
  if (employee.churchId || employee.districtId) {
    // Local staff escalate to the conference that owns their district/church.
    if (employee.conferenceId) {
      return scope("CONFERENCE", { conferenceId: employee.conferenceId });
    }
    if (employee.districtId) {
      return scope("DISTRICT", { districtId: employee.districtId });
    }
    return scope("CHURCH", { churchId: employee.churchId });
  }
  if (employee.conferenceId) {
    return employee.unionId
      ? scope("UNION", { unionId: employee.unionId })
      : scope("CONFERENCE", { conferenceId: employee.conferenceId });
  }
  return scope("UNION", { unionId: employee.unionId ?? null });
}

function scope(type: LeaveScopeType, ids: EmployeeScope): ResolvedApproverScope {
  return {
    approverScopeType: type,
    approverUnionId: ids.unionId ?? null,
    approverConferenceId: ids.conferenceId ?? null,
    approverDistrictId: ids.districtId ?? null,
    approverChurchId: ids.churchId ?? null
  };
}

export async function nextApplicationNumber() {
  const count = await prisma.leaveApplication.count();
  return `LV-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}

/**
 * Days accrued for a monthly-accrual leave type in a given year: the rate times
 * the number of months elapsed (full year for past years, none for future years).
 */
export function accruedEntitlement(rate: number, year: number, now: Date = new Date()) {
  if (year < now.getFullYear()) return rate * 12;
  if (year > now.getFullYear()) return 0;
  return rate * (now.getMonth() + 1);
}

/**
 * Ensure a balance row exists for the employee/leaveType/year. For accrual-based
 * leave types the entitlement is recomputed (it grows as months pass); otherwise
 * it is seeded from the leave type's default annual days. Returns the balance row.
 */
export async function ensureBalance(employeeId: string, leaveTypeId: string, year: number) {
  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  const entitledDays =
    leaveType?.monthlyAccrualRate != null
      ? accruedEntitlement(leaveType.monthlyAccrualRate, year)
      : leaveType?.defaultAnnualDays ?? 0;

  const existing = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } }
  });
  if (existing) {
    // Keep accrual-based entitlements current as the year progresses.
    if (leaveType?.monthlyAccrualRate != null && existing.entitledDays !== entitledDays) {
      return prisma.leaveBalance.update({
        where: { id: existing.id },
        data: { entitledDays }
      });
    }
    return existing;
  }
  return prisma.leaveBalance.create({
    data: { employeeId, leaveTypeId, year, entitledDays }
  });
}

export function remainingDays(balance: {
  entitledDays: number;
  carriedOverDays: number;
  usedDays: number;
  pendingDays: number;
}) {
  return (
    balance.entitledDays + balance.carriedOverDays - balance.usedDays - balance.pendingDays
  );
}

type LeaveWithScope = {
  status: string;
  supervisorUserId: string | null;
  approverScopeType: string;
  approverUnionId: string | null;
  approverConferenceId: string | null;
  approverDistrictId: string | null;
  approverChurchId: string | null;
  employee: { userId: string | null };
};

export function leaveAccessContext(leave: LeaveWithScope): LeaveAccessContext {
  return {
    status: leave.status,
    employeeUserId: leave.employee.userId,
    supervisorUserId: leave.supervisorUserId,
    approverScopeType: leave.approverScopeType,
    approverUnionId: leave.approverUnionId,
    approverConferenceId: leave.approverConferenceId,
    approverDistrictId: leave.approverDistrictId,
    approverChurchId: leave.approverChurchId
  };
}

export async function getLeaveApplicationById(id: string) {
  return prisma.leaveApplication.findUnique({
    where: { id },
    include: leaveApplicationInclude
  });
}

export type LeaveApplicationWithRelations = NonNullable<
  Awaited<ReturnType<typeof getLeaveApplicationById>>
>;

export async function getVisibleLeaveApplications(user: AuthUser, options?: { take?: number }) {
  const applications = await prisma.leaveApplication.findMany({
    include: leaveApplicationInclude,
    orderBy: { updatedAt: "desc" },
    take: options?.take
  });
  return applications.filter((application) => canViewLeave(user, leaveAccessContext(application)));
}

export function leaveApplicationsAwaitingUser(
  user: AuthUser,
  applications: LeaveApplicationWithRelations[]
) {
  return applications.filter((application) =>
    canApproveLeave(user, leaveAccessContext(application))
  );
}

export async function getVisibleEmployees(user: AuthUser) {
  const employees = await prisma.employee.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: { user: { include: { role: true } } }
  });
  if (isSuperAdmin(user) || user.roleName === "HR Manager") return employees;
  return employees.filter((employee) => {
    if (employee.userId === user.id) return true;
    if (user.unionId && employee.unionId === user.unionId) return true;
    if (user.conferenceId && employee.conferenceId === user.conferenceId) return true;
    if (user.districtId && employee.districtId === user.districtId) return true;
    if (user.churchId && employee.churchId === user.churchId) return true;
    return false;
  });
}
