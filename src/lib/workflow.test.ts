import { describe, expect, it } from "vitest";
import { determineApprovalPath } from "./workflow";
import type { ChurchHierarchy } from "./types";

function churchFixture(input: {
  id: string;
  districtId: string;
  conferenceId: string;
  unionId: string;
}): ChurchHierarchy {
  return {
    id: input.id,
    name: input.id,
    districtId: input.districtId,
    district: {
      id: input.districtId,
      name: input.districtId,
      conferenceId: input.conferenceId,
      conference: {
        id: input.conferenceId,
        name: input.conferenceId,
        unionId: input.unionId,
        union: {
          id: input.unionId,
          name: input.unionId
        }
      }
    }
  };
}

describe("determineApprovalPath", () => {
  const requestingChurch = churchFixture({
    id: "church-a",
    districtId: "district-a",
    conferenceId: "conference-a",
    unionId: "union-a"
  });

  it("routes same-district requests from pastor to destination acceptance", () => {
    const targetChurch = churchFixture({
      id: "church-b",
      districtId: "district-a",
      conferenceId: "conference-a",
      unionId: "union-a"
    });

    const path = determineApprovalPath(requestingChurch, { church: targetChurch });

    expect(path.map((step) => step.stage)).toEqual([
      "PASTOR",
      "DESTINATION"
    ]);
    expect(path[0]).toMatchObject({
      assignedRoleGroup: "District Pastor",
      assignedScopeType: "DISTRICT",
      assignedDistrictId: "district-a"
    });
    expect(path[1]).toMatchObject({
      assignedScopeType: "CHURCH",
      assignedChurchId: "church-b"
    });
  });

  it("routes to conference when crossing districts in the same conference", () => {
    const targetChurch = churchFixture({
      id: "church-c",
      districtId: "district-b",
      conferenceId: "conference-a",
      unionId: "union-a"
    });

    expect(determineApprovalPath(requestingChurch, { church: targetChurch }).map((step) => step.stage)).toEqual([
      "PASTOR",
      "CONFERENCE",
      "DESTINATION"
    ]);
  });

  it("routes through requesting and destination conference when crossing conferences in the same union", () => {
    const targetChurch = churchFixture({
      id: "church-d",
      districtId: "district-c",
      conferenceId: "conference-b",
      unionId: "union-a"
    });

    expect(determineApprovalPath(requestingChurch, { church: targetChurch }).map((step) => step.stage)).toEqual([
      "PASTOR",
      "CONFERENCE",
      "UNION",
      "CONFERENCE",
      "DESTINATION"
    ]);

    const path = determineApprovalPath(requestingChurch, { church: targetChurch });
    expect(path[1]).toMatchObject({
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: "conference-a",
      assignedRoleGroup: "Requesting Conference: Conference President, Conference Secretary, Conference Admin, Conference Pastor"
    });
    expect(path[3]).toMatchObject({
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: "conference-b",
      assignedRoleGroup: "Destination Conference: Conference President, Conference Secretary, Conference Admin, Conference Pastor"
    });
  });

  it("routes through destination union and destination conference when crossing unions", () => {
    const targetChurch = churchFixture({
      id: "church-e",
      districtId: "district-d",
      conferenceId: "conference-c",
      unionId: "union-b"
    });

    const path = determineApprovalPath(requestingChurch, { church: targetChurch });

    expect(path.map((step) => step.stage)).toEqual([
      "PASTOR",
      "CONFERENCE",
      "UNION",
      "UNION",
      "CONFERENCE",
      "DESTINATION"
    ]);
    expect(path[2]).toMatchObject({
      assignedScopeType: "UNION",
      assignedUnionId: "union-a",
      assignedRoleGroup: "Requesting Union: Union President, Union Secretary, Union Admin"
    });
    expect(path[3]).toMatchObject({
      assignedScopeType: "UNION",
      assignedUnionId: "union-b",
      assignedRoleGroup: "Destination Union: Union President, Union Secretary, Union Admin"
    });
    expect(path[4]).toMatchObject({
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: "conference-c",
      assignedRoleGroup: "Destination Conference: Conference President, Conference Secretary, Conference Admin, Conference Pastor"
    });
  });
});
