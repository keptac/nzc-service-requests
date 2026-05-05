import { prisma } from "./prisma";
import { sendWhatsAppNotifications } from "./whatsapp";
import { APPROVER_ROLES, type ApprovalStage } from "./constants";

type Scope = {
  assignedScopeType: string;
  assignedChurchId?: string | null;
  assignedDistrictId?: string | null;
  assignedConferenceId?: string | null;
  assignedUnionId?: string | null;
};

export async function usersForApprovalStage(stage: ApprovalStage, scope: Scope) {
  return prisma.user.findMany({
    where: {
      active: true,
      role: { name: { in: APPROVER_ROLES[stage] } },
      ...(scope.assignedScopeType === "CHURCH" ? { churchId: scope.assignedChurchId } : {}),
      ...(scope.assignedScopeType === "DISTRICT" ? { districtId: scope.assignedDistrictId } : {}),
      ...(scope.assignedScopeType === "CONFERENCE"
        ? { conferenceId: scope.assignedConferenceId }
        : {}),
      ...(scope.assignedScopeType === "UNION" ? { unionId: scope.assignedUnionId } : {})
    },
    select: { id: true }
  });
}

export async function notifyUsers(input: {
  userIds: string[];
  requestId?: string;
  title: string;
  body: string;
}) {
  const uniqueIds = Array.from(new Set(input.userIds));
  if (uniqueIds.length === 0) return;

  await prisma.notification.createMany({
    data: uniqueIds.map((userId) => ({
      userId,
      requestId: input.requestId,
      title: input.title,
      body: input.body
    }))
  });

  await sendWhatsAppNotifications({
    userIds: uniqueIds,
    requestId: input.requestId,
    title: input.title,
    body: input.body
  }).catch((error) => {
    console.error("WhatsApp notification failed", error);
  });
}

export async function notifyNextApprovers(input: {
  requestId: string;
  requestNumber: string;
  title: string;
  stage: ApprovalStage;
  scope: Scope;
}) {
  const users = await usersForApprovalStage(input.stage, input.scope);
  await notifyUsers({
    userIds: users.map((user) => user.id),
    requestId: input.requestId,
    title: `Approval needed: ${input.requestNumber}`,
    body: `${input.title} is awaiting ${input.stage === "DESTINATION" ? "destination church acceptance" : `${input.stage.toLowerCase()} approval`}.`
  });
}

export async function notifyRequester(input: {
  requesterId: string;
  requestId: string;
  requestNumber: string;
  title: string;
  status: string;
}) {
  await notifyUsers({
    userIds: [input.requesterId],
    requestId: input.requestId,
      title: `${input.requestNumber} ${input.status.toLowerCase().replace(/_/g, " ")}`,
      body: `${input.title} is now ${input.status.toLowerCase().replace(/_/g, " ")}.`
  });
}
