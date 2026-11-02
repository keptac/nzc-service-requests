import { describe, expect, it } from "vitest";
import {
  canAdcomApproveLeave,
  canApproveLeave,
  canCancelLeave,
  canSupervisorApproveLeave,
  canViewLeave,
  leaveRequiresMinute,
  leaveStage
} from "./permissions";
import { accruedEntitlement, countLeaveDays, remainingDays, resolveApproverScope } from "./leave";
import type { AuthUser, LeaveAccessContext } from "./types";

function user(roleName: AuthUser["roleName"], scope: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@sda.local",
    roleName,
    preferredLanguage: "en",
    active: true,
    unionId: null,
    conferenceId: null,
    districtId: null,
    churchId: null,
    ...scope
  };
}

// Stage 1: awaiting the supervisor's recommendation.
const submittedLeave: LeaveAccessContext = {
  status: "SUBMITTED",
  employeeUserId: "applicant",
  supervisorUserId: "supervisor",
  approverScopeType: "CONFERENCE",
  approverConferenceId: "conference-a",
  approverUnionId: "union-a",
  approverDistrictId: null,
  approverChurchId: null
};

// Stage 2: supervisor recommended, awaiting the ADCOM minute number.
const adcomLeave: LeaveAccessContext = { ...submittedLeave, status: "RECOMMENDED" };

describe("countLeaveDays", () => {
  it("counts inclusive calendar days", () => {
    expect(countLeaveDays("2026-06-01", "2026-06-05")).toBe(5);
    expect(countLeaveDays("2026-06-01", "2026-06-01")).toBe(1);
  });

  it("returns 0 for an inverted or invalid range", () => {
    expect(countLeaveDays("2026-06-05", "2026-06-01")).toBe(0);
  });
});

describe("accruedEntitlement", () => {
  it("accrues 2.5 days per month elapsed in the current year", () => {
    // June (month index 5) → 6 months × 2.5 = 15 days.
    const june = new Date(2026, 5, 18);
    expect(accruedEntitlement(2.5, 2026, june)).toBe(15);
    // January → 1 month × 2.5.
    expect(accruedEntitlement(2.5, 2026, new Date(2026, 0, 1))).toBe(2.5);
  });

  it("grants a full year for past years and none for future years", () => {
    const june = new Date(2026, 5, 18);
    expect(accruedEntitlement(2.5, 2025, june)).toBe(30);
    expect(accruedEntitlement(2.5, 2027, june)).toBe(0);
  });
});

describe("remainingDays", () => {
  it("subtracts used and pending from entitlement plus carry over", () => {
    expect(
      remainingDays({ entitledDays: 24, carriedOverDays: 2, usedDays: 5, pendingDays: 3 })
    ).toBe(18);
  });
});

describe("resolveApproverScope", () => {
  it("routes local church staff to their conference", () => {
    const scope = resolveApproverScope({
      churchId: "church-a",
      districtId: "district-a",
      conferenceId: "conference-a",
      unionId: "union-a"
    });
    expect(scope.approverScopeType).toBe("CONFERENCE");
    expect(scope.approverConferenceId).toBe("conference-a");
  });

  it("routes conference staff to their union", () => {
    const scope = resolveApproverScope({ conferenceId: "conference-a", unionId: "union-a" });
    expect(scope.approverScopeType).toBe("UNION");
    expect(scope.approverUnionId).toBe("union-a");
  });
});

describe("leaveStage", () => {
  it("maps status to the active approval stage", () => {
    expect(leaveStage("SUBMITTED")).toBe("SUPERVISOR");
    expect(leaveStage("RECOMMENDED")).toBe("ADCOM");
    expect(leaveStage("APPROVED")).toBeNull();
  });
});

describe("stage 1 — supervisor recommendation", () => {
  it("lets the assigned supervisor recommend a submitted application", () => {
    const supervisor = user("District Pastor", { id: "supervisor" });
    expect(canSupervisorApproveLeave(supervisor, submittedLeave)).toBe(true);
    expect(canApproveLeave(supervisor, submittedLeave)).toBe(true);
  });

  it("does not let a scope ADCOM approver act before the supervisor", () => {
    const admin = user("Conference Admin", { conferenceId: "conference-a" });
    expect(canSupervisorApproveLeave(admin, submittedLeave)).toBe(false);
    expect(canAdcomApproveLeave(admin, submittedLeave)).toBe(false);
  });

  it("does not require a minute number at the supervisor stage", () => {
    expect(leaveRequiresMinute(submittedLeave)).toBe(false);
  });

  it("lets HR Manager stand in for a missing supervisor", () => {
    expect(canSupervisorApproveLeave(user("HR Manager"), submittedLeave)).toBe(true);
  });

  it("prevents the applicant from recommending their own leave", () => {
    const applicant = user("Church Clerk", { id: "applicant", churchId: "church-a" });
    expect(canSupervisorApproveLeave(applicant, submittedLeave)).toBe(false);
  });
});

describe("stage 2 — ADCOM minute", () => {
  it("lets a matching conference admin give final approval", () => {
    const admin = user("Conference Admin", { conferenceId: "conference-a" });
    expect(canAdcomApproveLeave(admin, adcomLeave)).toBe(true);
    expect(canApproveLeave(admin, adcomLeave)).toBe(true);
  });

  it("blocks an out-of-scope conference admin", () => {
    const admin = user("Conference Admin", { conferenceId: "conference-b" });
    expect(canAdcomApproveLeave(admin, adcomLeave)).toBe(false);
  });

  it("requires a minute number at the ADCOM stage", () => {
    expect(leaveRequiresMinute(adcomLeave)).toBe(true);
  });

  it("does not let the supervisor alone finalize at ADCOM", () => {
    const supervisor = user("Church Clerk", { id: "supervisor", churchId: "church-z" });
    expect(canAdcomApproveLeave(supervisor, adcomLeave)).toBe(false);
  });
});

describe("leave visibility and cancellation", () => {
  it("lets the supervisor and applicant view the application", () => {
    expect(canViewLeave(user("District Pastor", { id: "supervisor" }), submittedLeave)).toBe(true);
    expect(canViewLeave(user("Church Clerk", { id: "applicant" }), submittedLeave)).toBe(true);
  });

  it("lets the applicant cancel their own pending leave", () => {
    const applicant = user("Church Clerk", { id: "applicant", churchId: "church-a" });
    expect(canCancelLeave(applicant, submittedLeave)).toBe(true);
    expect(canCancelLeave(applicant, { ...submittedLeave, status: "APPROVED" })).toBe(false);
  });
});
