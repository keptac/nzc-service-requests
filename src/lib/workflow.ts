import {
  APPROVER_ROLES,
  STAGE_TO_STATUS,
  type ApprovalStage,
  type RequestStatus
} from "./constants";
import type { ChurchHierarchy, WorkflowStepInput, WorkflowTarget } from "./types";

export function workflowStepForStage(
  stage: ApprovalStage,
  stepOrder: number,
  requestingChurch: ChurchHierarchy,
  target: WorkflowTarget = {}
): WorkflowStepInput {
  if (stage === "DESTINATION") {
    if (!target.church || target.church.id === requestingChurch.id) {
      throw new Error("Destination acceptance requires a target church.");
    }

    return {
      stage,
      stepOrder,
      assignedRoleGroup: APPROVER_ROLES.DESTINATION.join(", "),
      assignedScopeType: "CHURCH",
      assignedChurchId: target.church.id
    };
  }

  if (stage === "PASTOR") {
    return {
      stage,
      stepOrder,
      assignedRoleGroup: APPROVER_ROLES.PASTOR.join(", "),
      assignedScopeType: "DISTRICT",
      assignedDistrictId: requestingChurch.district.id
    };
  }

  if (stage === "CONFERENCE") {
    return {
      stage,
      stepOrder,
      assignedRoleGroup: APPROVER_ROLES.CONFERENCE.join(", "),
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: requestingChurch.district.conference.id
    };
  }

  return {
    stage,
    stepOrder,
    assignedRoleGroup: APPROVER_ROLES.UNION.join(", "),
    assignedScopeType: "UNION",
    assignedUnionId: requestingChurch.district.conference.union.id
  };
}

export function determineApprovalPath(
  requestingChurch: ChurchHierarchy,
  target: WorkflowTarget = {}
): WorkflowStepInput[] {
  const stages: ApprovalStage[] = ["PASTOR"];
  const requestDistrictId = requestingChurch.district.id;
  const requestConferenceId = requestingChurch.district.conference.id;
  const requestUnionId = requestingChurch.district.conference.union.id;

  const resolvedTargetDistrictId = target.church?.district.id ?? target.district?.id ?? null;
  const resolvedTargetConferenceId =
    target.church?.district.conference.id ?? target.district?.conference.id ?? target.conference?.id ?? null;
  const resolvedTargetUnionId =
    target.church?.district.conference.union.id ??
    target.district?.conference.union.id ??
    target.conference?.union.id ??
    target.union?.id ??
    null;

  const mapStages = () => {
    const steps = stages.map((stage, index) => workflowStepForStage(stage, index + 1, requestingChurch));
    if (!target.church || target.church.id === requestingChurch.id) return steps;

    return [
      ...steps,
      workflowStepForStage("DESTINATION", steps.length + 1, requestingChurch, { church: target.church })
    ];
  };

  if (resolvedTargetDistrictId && resolvedTargetDistrictId === requestDistrictId) {
    return mapStages();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId !== requestConferenceId) {
    stages.push("CONFERENCE");
    if (resolvedTargetUnionId !== requestUnionId || resolvedTargetConferenceId !== requestConferenceId) {
      stages.push("UNION");
    }
    return mapStages();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId === requestConferenceId) {
    stages.push("CONFERENCE");
    return mapStages();
  }

  if (resolvedTargetUnionId && resolvedTargetUnionId !== requestUnionId) {
    stages.push("CONFERENCE", "UNION");
    return mapStages();
  }

  return mapStages();
}

export function nextPendingStatus(stage: ApprovalStage): RequestStatus {
  return STAGE_TO_STATUS[stage];
}

export function nextEscalationStage(existingStages: string[], requested?: ApprovalStage) {
  if (requested && !existingStages.includes(requested)) return requested;
  if (!existingStages.includes("CONFERENCE")) return "CONFERENCE" satisfies ApprovalStage;
  if (!existingStages.includes("UNION")) return "UNION" satisfies ApprovalStage;
  return null;
}

export function stageDisplayName(stage: string) {
  const names: Record<string, string> = {
    DESTINATION: "Destination Church Acceptance",
    PASTOR: "District Pastor",
    CONFERENCE: "Conference Leadership",
    UNION: "Union Leadership"
  };
  return names[stage] ?? stage;
}
