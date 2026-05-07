import { stageDisplayName } from "./workflow";

export type ApprovalDisplayStep = {
  stage: string;
  assignedRoleGroup: string;
  assignedScopeType?: string | null;
  assignedChurch?: { name: string } | null;
  assignedDistrict?: { name: string } | null;
  assignedConference?: { name: string } | null;
  assignedUnion?: { name: string } | null;
};

export function assignedScopeName(step: ApprovalDisplayStep) {
  if (step.assignedScopeType === "CHURCH") return step.assignedChurch?.name;
  if (step.assignedScopeType === "DISTRICT") return step.assignedDistrict?.name;
  if (step.assignedScopeType === "CONFERENCE") return step.assignedConference?.name;
  if (step.assignedScopeType === "UNION") return step.assignedUnion?.name;
  return (
    step.assignedConference?.name ??
    step.assignedUnion?.name ??
    step.assignedDistrict?.name ??
    step.assignedChurch?.name
  );
}

export function approvalStageName(step: ApprovalDisplayStep) {
  const scopeName = assignedScopeName(step);
  if (!scopeName) return stageDisplayName(step.stage);

  if (step.stage === "DESTINATION") return `${scopeName} Acceptance`;
  if (step.stage === "PASTOR") {
    return scopeName.toLowerCase().endsWith("district") ? `${scopeName} Pastor` : `${scopeName} District Pastor`;
  }
  if (step.stage === "CONFERENCE") return `${scopeName} Leadership`;
  if (step.stage === "UNION") return `${scopeName} Leadership`;

  return `${stageDisplayName(step.stage)} - ${scopeName}`;
}

export function approvalAssignmentLabel(step: ApprovalDisplayStep) {
  const scopeName = assignedScopeName(step);
  if (!scopeName) return step.assignedRoleGroup;

  const [prefix, roles] = step.assignedRoleGroup.includes(": ")
    ? step.assignedRoleGroup.split(": ", 2)
    : ["", step.assignedRoleGroup];

  if (prefix) return `${prefix} - ${scopeName}: ${roles}`;
  return `${scopeName}: ${roles}`;
}
