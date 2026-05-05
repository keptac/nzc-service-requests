import { describe, expect, it } from "vitest";
import { canAccessCreateRequest, canActOnStep, canCreateRequest, canViewRequest } from "./permissions";
import type { AuthUser, RequestAccessContext } from "./types";

function user(roleName: AuthUser["roleName"], scope: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user-1",
    name: "Test User",
    email: "test@sda.local",
    roleName,
    active: true,
    unionId: null,
    conferenceId: null,
    districtId: null,
    churchId: null,
    ...scope
  };
}

const request: RequestAccessContext = {
  requesterId: "requester",
  requestingChurch: {
    id: "church-a",
    name: "Church A",
    districtId: "district-a",
    district: {
      id: "district-a",
      name: "District A",
      conferenceId: "conference-a",
      conference: {
        id: "conference-a",
        name: "Conference A",
        unionId: "union-a",
        union: { id: "union-a", name: "Union A" }
      }
    }
  }
};

describe("role permissions", () => {
  it("allows a church clerk to create requests only for their assigned church", () => {
    const clerk = user("Church Clerk", { churchId: "church-a" });
    expect(canAccessCreateRequest(clerk)).toBe(true);
    expect(canCreateRequest(clerk, "church-a")).toBe(true);
    expect(canCreateRequest(clerk, "church-b")).toBe(false);
  });

  it("hides request creation from roles without clerk create rights", () => {
    expect(canAccessCreateRequest(user("District Pastor", { districtId: "district-a" }))).toBe(false);
    expect(canAccessCreateRequest(user("Super Admin"))).toBe(false);
    expect(canAccessCreateRequest(user("Church Clerk"))).toBe(false);
  });

  it("prevents lower hierarchy users from viewing unrelated requests", () => {
    const elder = user("Church Elder", { churchId: "church-b" });
    expect(canViewRequest(elder, request)).toBe(false);
  });

  it("allows district pastor action only in the assigned district", () => {
    const pastor = user("District Pastor", { districtId: "district-a" });
    expect(
      canActOnStep(pastor, {
        stage: "PASTOR",
        status: "PENDING",
        assignedScopeType: "DISTRICT",
        assignedDistrictId: "district-a"
      })
    ).toBe(true);
    expect(
      canActOnStep(pastor, {
        stage: "PASTOR",
        status: "PENDING",
        assignedScopeType: "DISTRICT",
        assignedDistrictId: "district-b"
      })
    ).toBe(false);
  });

  it("allows destination church users to accept only for their assigned church", () => {
    const clerk = user("Church Clerk", { churchId: "church-b" });
    expect(
      canActOnStep(clerk, {
        stage: "DESTINATION",
        status: "PENDING",
        assignedScopeType: "CHURCH",
        assignedChurchId: "church-b"
      })
    ).toBe(true);
    expect(
      canActOnStep(clerk, {
        stage: "DESTINATION",
        status: "PENDING",
        assignedScopeType: "CHURCH",
        assignedChurchId: "church-c"
      })
    ).toBe(false);
  });

  it("allows super admin to view and act across the system", () => {
    const admin = user("Super Admin");
    expect(canViewRequest(admin, request)).toBe(true);
    expect(
      canActOnStep(admin, {
        stage: "UNION",
        status: "PENDING",
        assignedScopeType: "UNION",
        assignedUnionId: "another-union"
      })
    ).toBe(true);
  });
});
