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
  target: WorkflowTarget = {},
  options: {
    assignedConferenceId?: string;
    assignedUnionId?: string;
    assignedRoleGroupPrefix?: string;
  } = {}
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
      assignedRoleGroup: [
        options.assignedRoleGroupPrefix,
        APPROVER_ROLES.CONFERENCE.join(", ")
      ].filter(Boolean).join(": "),
      assignedScopeType: "CONFERENCE",
      assignedConferenceId: options.assignedConferenceId ?? requestingChurch.district.conference.id
    };
  }

  return {
    stage,
    stepOrder,
    assignedRoleGroup: [
      options.assignedRoleGroupPrefix,
      APPROVER_ROLES.UNION.join(", ")
    ].filter(Boolean).join(": "),
    assignedScopeType: "UNION",
    assignedUnionId: options.assignedUnionId ?? requestingChurch.district.conference.union.id
  };
}

export function determineApprovalPath(
  requestingChurch: ChurchHierarchy,
  target: WorkflowTarget = {}
): WorkflowStepInput[] {
  const steps: WorkflowStepInput[] = [];
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

  const addRequestingStage = (stage: ApprovalStage) => {
    const prefix = stage === "CONFERENCE" ? "Requesting Conference" : stage === "UNION" ? "Requesting Union" : undefined;
    steps.push(
      workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, { assignedRoleGroupPrefix: prefix })
    );
  };

  const addDestinationStage = (stage: Extract<ApprovalStage, "CONFERENCE" | "UNION">) => {
    if (stage === "UNION" && resolvedTargetUnionId) {
      steps.push(
        workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, {
          assignedRoleGroupPrefix: "Destination Union",
          assignedUnionId: resolvedTargetUnionId
        })
      );
    }

    if (stage === "CONFERENCE" && resolvedTargetConferenceId) {
      steps.push(
        workflowStepForStage(stage, steps.length + 1, requestingChurch, {}, {
          assignedRoleGroupPrefix: "Destination Conference",
          assignedConferenceId: resolvedTargetConferenceId
        })
      );
    }
  };

  const addDestinationChurchAcceptance = () => {
    if (!target.church || target.church.id === requestingChurch.id) return steps;

    steps.push(workflowStepForStage("DESTINATION", steps.length + 1, requestingChurch, { church: target.church }));
    return steps;
  };

  addRequestingStage("PASTOR");

  if (resolvedTargetDistrictId && resolvedTargetDistrictId === requestDistrictId) {
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetUnionId && resolvedTargetUnionId !== requestUnionId) {
    addRequestingStage("CONFERENCE");
    addRequestingStage("UNION");
    addDestinationStage("UNION");
    addDestinationStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId === requestConferenceId) {
    addRequestingStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  if (resolvedTargetConferenceId && resolvedTargetConferenceId !== requestConferenceId) {
    addRequestingStage("CONFERENCE");
    addRequestingStage("UNION");
    addDestinationStage("CONFERENCE");
    return addDestinationChurchAcceptance();
  }

  return addDestinationChurchAcceptance();
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
