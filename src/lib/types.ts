import type { ApprovalStage, RoleName } from "./constants";

export type ChurchHierarchy = {
  id: string;
  name: string;
  districtId: string;
  district: {
    id: string;
    name: string;
    conferenceId: string;
    conference: {
      id: string;
      name: string;
      unionId: string;
      union: {
        id: string;
        name: string;
      };
    };
  };
};

export type WorkflowTarget = {
  church?: ChurchHierarchy | null;
  district?: {
    id: string;
    name: string;
    conferenceId: string;
    conference: {
      id: string;
      name: string;
      unionId: string;
      union: { id: string; name: string };
    };
  } | null;
  conference?: {
    id: string;
    name: string;
    unionId: string;
    union: { id: string; name: string };
  } | null;
  union?: {
    id: string;
    name: string;
  } | null;
};

export type WorkflowStepInput = {
  stage: ApprovalStage;
  stepOrder: number;
  assignedRoleGroup: string;
  assignedScopeType: "CHURCH" | "DISTRICT" | "CONFERENCE" | "UNION";
  assignedChurchId?: string;
  assignedDistrictId?: string;
  assignedConferenceId?: string;
  assignedUnionId?: string;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  roleName: RoleName;
  active: boolean;
  unionId: string | null;
  conferenceId: string | null;
  districtId: string | null;
  churchId: string | null;
};

export type RequestAccessContext = {
  requesterId: string;
  requestingChurch: ChurchHierarchy;
  targetChurch?: ChurchHierarchy | null;
  targetDistrict?: {
    id: string;
    conferenceId: string;
    conference: { id: string; unionId: string };
  } | null;
  targetConference?: {
    id: string;
    unionId: string;
  } | null;
  targetUnion?: {
    id: string;
  } | null;
};

export type StepAccessContext = {
  stage: ApprovalStage;
  status: string;
  assignedScopeType: string;
  assignedChurchId?: string | null;
  assignedDistrictId?: string | null;
  assignedConferenceId?: string | null;
  assignedUnionId?: string | null;
};
