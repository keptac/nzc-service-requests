import { prisma } from "./prisma";
import { canActOnStep, canViewRequest } from "./permissions";
import type { AuthUser, RequestAccessContext } from "./types";
import type { ApprovalStage } from "./constants";

export const requestInclude = {
  type: true,
  requester: { include: { role: true } },
  requestingChurch: {
    include: {
      district: {
        include: {
          conference: {
            include: {
              union: true
            }
          }
        }
      }
    }
  },
  targetChurch: {
    include: {
      district: {
        include: {
          conference: {
            include: {
              union: true
            }
          }
        }
      }
    }
  },
  targetDistrict: {
    include: {
      conference: {
        include: {
          union: true
        }
      }
    }
  },
  targetConference: {
    include: {
      union: true
    }
  },
  targetUnion: true,
  approvalSteps: {
    include: {
      actedBy: true
    },
    orderBy: {
      stepOrder: "asc" as const
    }
  },
  comments: {
    include: {
      author: {
        include: {
          role: true
        }
      }
    },
    orderBy: {
      createdAt: "asc" as const
    }
  },
  attachments: {
    include: {
      uploader: true
    },
    orderBy: {
      createdAt: "desc" as const
    }
  },
  auditLogs: {
    include: {
      actor: true
    },
    orderBy: {
      createdAt: "desc" as const
    }
  }
};

export type RequestWithRelations = Awaited<ReturnType<typeof getRequestById>>;

export function accessContext(request: NonNullable<RequestWithRelations>): RequestAccessContext {
  return {
    requesterId: request.requesterId,
    requestingChurch: request.requestingChurch,
    targetChurch: request.targetChurch,
    targetDistrict: request.targetDistrict,
    targetConference: request.targetConference,
    targetUnion: request.targetUnion
  };
}

export async function getRequestById(id: string) {
  return prisma.serviceRequest.findUnique({
    where: { id },
    include: requestInclude
  });
}

export async function getVisibleRequests(user: AuthUser, options?: { take?: number }) {
  const requests = await prisma.serviceRequest.findMany({
    include: requestInclude,
    orderBy: { updatedAt: "desc" },
    take: options?.take
  });

  return requests.filter((request) => canViewRequest(user, accessContext(request)));
}

export function currentPendingStep(request: NonNullable<RequestWithRelations>) {
  return request.approvalSteps.find(
    (step) => step.stepOrder === request.currentStepOrder && step.status === "PENDING"
  );
}

export function requestsAwaitingUser(user: AuthUser, requests: NonNullable<RequestWithRelations>[]) {
  return requests.filter((request) => {
    const step = currentPendingStep(request);
    if (!step) return false;

    return canActOnStep(user, {
      stage: step.stage as ApprovalStage,
      status: step.status,
      assignedScopeType: step.assignedScopeType,
      assignedChurchId: step.assignedChurchId,
      assignedDistrictId: step.assignedDistrictId,
      assignedConferenceId: step.assignedConferenceId,
      assignedUnionId: step.assignedUnionId
    });
  });
}

export async function nextRequestNumber() {
  const count = await prisma.serviceRequest.count();
  return `SDA-${new Date().getFullYear()}-${String(count + 1).padStart(5, "0")}`;
}
