import { prisma } from "./prisma";
import { auditLog } from "./audit";
import { accessContext, currentPendingStep, nextRequestNumber, requestInclude } from "./requests";
import { canActOnStep, canCreateRequest, canViewRequest } from "./permissions";
import { determineApprovalPath, nextPendingStatus } from "./workflow";
import { notifyNextApprovers, notifyRequester } from "./notifications";
import { normalizeWhatsAppNumber } from "./phone";
import { resolveRequestSignatories } from "./signatories";
import { statusLabel } from "./format";
import type { ApprovalStage, RequestStatus } from "./constants";
import type { AuthUser } from "./types";

type CommandUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  unionId: string | null;
  conferenceId: string | null;
  districtId: string | null;
  churchId: string | null;
  role: { name: string };
};

function authUser(user: CommandUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    active: user.active,
    roleName: user.role.name as AuthUser["roleName"],
    unionId: user.unionId,
    conferenceId: user.conferenceId,
    districtId: user.districtId,
    churchId: user.churchId
  };
}

function helpText() {
  return [
    "SDA Service Request Tracker WhatsApp commands:",
    "STATUS <request-number>",
    "APPROVE <request-number> [comment]",
    "APPROVE <request-number> MINUTE <minute-number> [comment] for destination church acceptance",
    "DECLINE <request-number> <comment>",
    "RETURN <request-number> <comment>",
    "REQUEST <type> | <title> | <description> | <target church> | <yyyy-mm-dd>",
    "Only approved WhatsApp numbers can use these commands."
  ].join("\n");
}

function splitCommand(body: string) {
  const trimmed = body.trim();
  const [command = "", ...rest] = trimmed.split(/\s+/);
  return {
    command: command.toUpperCase(),
    rest: trimmed.slice(command.length).trim()
  };
}

function splitRequestNumberAndComment(rest: string) {
  const [requestNumber = "", ...commentParts] = rest.split(/\s+/);
  return {
    requestNumber: requestNumber.trim(),
    comment: commentParts.join(" ").trim()
  };
}

function splitMinuteNumberAndComment(comment: string) {
  const match = comment.trim().match(/^(?:MIN|MINUTE)\s+(\S+)(?:\s+(.+))?$/i);
  return {
    minuteNumber: match?.[1]?.trim(),
    comment: match ? match[2]?.trim() ?? "" : comment
  };
}

async function findRequestByNumber(requestNumber: string) {
  return prisma.serviceRequest.findFirst({
    where: {
      requestNumber: {
        equals: requestNumber,
        mode: "insensitive"
      }
    },
    include: requestInclude
  });
}

async function statusReply(user: AuthUser, requestNumber: string) {
  if (!requestNumber) return "Use STATUS <request-number>.";
  const serviceRequest = await findRequestByNumber(requestNumber);
  if (!serviceRequest || !canViewRequest(user, accessContext(serviceRequest))) {
    return `No accessible request found for ${requestNumber}.`;
  }

  const pendingStep = currentPendingStep(serviceRequest);
  const pendingLine = pendingStep ? `Pending stage: ${pendingStep.stage}` : "No pending approval stage.";
  return [
    `${serviceRequest.requestNumber}`,
    serviceRequest.title,
    `Status: ${statusLabel(serviceRequest.status)}`,
    pendingLine
  ].join("\n");
}

async function approveOrCloseRequest(input: {
  user: AuthUser;
  requestNumber: string;
  action: "APPROVE" | "DECLINE" | "RETURN";
  comment: string;
  minuteNumber?: string;
}) {
  if (!input.requestNumber) return `Use ${input.action} <request-number>${input.action === "APPROVE" ? " [comment]" : " <comment>"}.`;
  if ((input.action === "DECLINE" || input.action === "RETURN") && !input.comment) {
    return `${input.action === "DECLINE" ? "Decline" : "Return"} requires a comment.`;
  }

  const serviceRequest = await findRequestByNumber(input.requestNumber);
  if (!serviceRequest || !canViewRequest(input.user, accessContext(serviceRequest))) {
    return `No accessible request found for ${input.requestNumber}.`;
  }

  const step = currentPendingStep(serviceRequest);
  if (!step) return `${serviceRequest.requestNumber} has no pending approval step.`;

  if (
    !canActOnStep(input.user, {
      stage: step.stage as ApprovalStage,
      status: step.status,
      assignedScopeType: step.assignedScopeType,
      assignedChurchId: step.assignedChurchId,
      assignedDistrictId: step.assignedDistrictId,
      assignedConferenceId: step.assignedConferenceId,
      assignedUnionId: step.assignedUnionId
    })
  ) {
    return `You are not authorized to act on ${serviceRequest.requestNumber}.`;
  }

  if (input.action === "APPROVE" && step.stage === "DESTINATION" && !input.minuteNumber) {
    return `Destination church acceptance requires a minute number. Use APPROVE ${serviceRequest.requestNumber} MINUTE <minute-number> [comment].`;
  }

  if (input.action === "DECLINE" || input.action === "RETURN") {
    const newStatus = input.action === "DECLINE" ? "DECLINED" : "RETURNED_FOR_CLARIFICATION";
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: input.action === "DECLINE" ? "DECLINED" : "RETURNED",
        actedById: input.user.id,
        actedAt: new Date(),
        comment: input.comment
      }
    });
    await prisma.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: newStatus,
        currentStepOrder: input.action === "DECLINE" ? null : step.stepOrder,
        comments: {
          create: {
            authorId: input.user.id,
            body: input.comment,
            system: true
          }
        }
      }
    });
    await notifyRequester({
      requesterId: serviceRequest.requesterId,
      requestId: serviceRequest.id,
      requestNumber: serviceRequest.requestNumber,
      title: serviceRequest.title,
      status: newStatus
    });
    await auditLog({
      actorId: input.user.id,
      requestId: serviceRequest.id,
      action: input.action === "DECLINE" ? "REQUEST_DECLINED_WHATSAPP" : "REQUEST_RETURNED_WHATSAPP",
      entityType: "ApprovalStep",
      entityId: step.id,
      metadata: { stage: step.stage }
    });

    return `${serviceRequest.requestNumber} ${statusLabel(newStatus)}.`;
  }

  await prisma.approvalStep.update({
    where: { id: step.id },
    data: {
      status: "APPROVED",
      actedById: input.user.id,
      actedAt: new Date(),
      comment: input.comment || null,
      minuteNumber: step.stage === "DESTINATION" ? input.minuteNumber : undefined
    }
  });

  const nextStep = serviceRequest.approvalSteps
    .filter((item) => item.stepOrder > step.stepOrder)
    .sort((a, b) => a.stepOrder - b.stepOrder)[0];
  const finalStatus = nextStep ? nextPendingStatus(nextStep.stage as ApprovalStage) : "APPROVED";

  await prisma.serviceRequest.update({
    where: { id: serviceRequest.id },
    data: {
      status: finalStatus,
      boardActionNumber: step.stage === "DESTINATION" ? input.minuteNumber : undefined,
      currentStepOrder: nextStep?.stepOrder ?? null,
      comments: input.comment
        ? {
            create: {
              authorId: input.user.id,
              body: input.comment,
              system: true
            }
          }
        : undefined
    }
  });

  if (nextStep) {
    await notifyNextApprovers({
      requestId: serviceRequest.id,
      requestNumber: serviceRequest.requestNumber,
      title: serviceRequest.title,
      stage: nextStep.stage as ApprovalStage,
      scope: nextStep
    });
  } else {
    await notifyRequester({
      requesterId: serviceRequest.requesterId,
      requestId: serviceRequest.id,
      requestNumber: serviceRequest.requestNumber,
      title: serviceRequest.title,
      status: "APPROVED"
    });
  }

  await auditLog({
    actorId: input.user.id,
    requestId: serviceRequest.id,
    action: "REQUEST_APPROVED_WHATSAPP",
    entityType: "ApprovalStep",
    entityId: step.id,
    metadata: { stage: step.stage, minuteNumber: step.stage === "DESTINATION" ? input.minuteNumber : undefined }
  });

  return `${serviceRequest.requestNumber} ${statusLabel(finalStatus)}.`;
}

async function createRequestFromWhatsApp(user: AuthUser, rest: string) {
  if (!canCreateRequest(user, user.churchId ?? "")) {
    return "Only approved Church Clerk numbers assigned to a church can create requests by WhatsApp.";
  }

  const [typeName, title, description, targetChurchName, proposedDate] = rest
    .split("|")
    .map((item) => item.trim());

  if (!typeName || !title || !description || !targetChurchName) {
    return "Use REQUEST <type> | <title> | <description> | <target church> | <yyyy-mm-dd>.";
  }

  const [requestingChurch, requestType, targetChurch] = await Promise.all([
    prisma.church.findUnique({
      where: { id: user.churchId! },
      include: { district: { include: { conference: { include: { union: true } } } } }
    }),
    prisma.serviceRequestType.findFirst({
      where: {
        name: {
          equals: typeName,
          mode: "insensitive"
        },
        active: true
      }
    }),
    prisma.church.findFirst({
      where: {
        name: {
          contains: targetChurchName,
          mode: "insensitive"
        },
        active: true
      },
      include: { district: { include: { conference: { include: { union: true } } } } },
      orderBy: { name: "asc" }
    })
  ]);

  if (!requestingChurch) return "Your user account is not assigned to a valid church.";
  if (!requestType) return `Unknown request type "${typeName}". Use Music Group, Preaching Assignment, Training, or Other.`;
  if (!targetChurch) return `No target church found for "${targetChurchName}".`;

  const workflow = determineApprovalPath(requestingChurch, { church: targetChurch });
  const firstStep = workflow[0];
  const requestNumber = await nextRequestNumber();
  const signatories = await resolveRequestSignatories({
    requesterId: user.id,
    districtId: requestingChurch.districtId
  });
  const serviceRequest = await prisma.serviceRequest.create({
    data: {
      requestNumber,
      typeId: requestType.id,
      title,
      description,
      requestingChurchId: requestingChurch.id,
      targetChurchId: targetChurch.id,
      proposedDate: proposedDate ? new Date(proposedDate) : null,
      contactPerson: user.name,
      contactEmail: user.email,
      serviceRequired: requestType.name,
      presentationMethod: "In person",
      fromWhere: `${requestingChurch.name}, ${requestingChurch.district.name}`,
      whereRequired: `${targetChurch.name}, ${targetChurch.district.name}`,
      clericalOfficeName: signatories.clericalOfficeName,
      clericalOfficePhone: signatories.clericalOfficePhone,
      districtPastorName: signatories.districtPastorName,
      districtPastorPhone: signatories.districtPastorPhone,
      priority: "NORMAL",
      requesterId: user.id,
      status: firstStep ? nextPendingStatus(firstStep.stage) : ("DRAFT" satisfies RequestStatus),
      currentStepOrder: firstStep?.stepOrder,
      approvalSteps: {
        create: workflow.map((step) => ({
          ...step,
          status: "PENDING"
        }))
      },
      comments: {
        create: {
          authorId: user.id,
          body: "Request submitted by WhatsApp.",
          system: true
        }
      }
    },
    include: {
      approvalSteps: true
    }
  });

  await auditLog({
    actorId: user.id,
    requestId: serviceRequest.id,
    action: "REQUEST_SUBMITTED_WHATSAPP",
    entityType: "ServiceRequest",
    entityId: serviceRequest.id,
    metadata: { requestNumber }
  });

  if (firstStep) {
    await notifyNextApprovers({
      requestId: serviceRequest.id,
      requestNumber,
      title: serviceRequest.title,
      stage: firstStep.stage,
      scope: firstStep
    });
  }

  return `${requestNumber} submitted for ${targetChurch.name}. Status: ${statusLabel(serviceRequest.status)}.`;
}

export async function handleWhatsAppCommand(input: {
  from: string;
  to?: string | null;
  body: string;
  providerMessageId?: string | null;
}) {
  const fromNumber = normalizeWhatsAppNumber(input.from);
  const toNumber = normalizeWhatsAppNumber(input.to);
  const user = fromNumber
    ? await prisma.user.findFirst({
        where: {
          active: true,
          whatsappEnabled: true,
          whatsappNumber: fromNumber
        },
        include: { role: true }
      })
    : null;

  await prisma.whatsAppMessage.create({
    data: {
      userId: user?.id,
      direction: "INBOUND",
      fromNumber: fromNumber ?? input.from,
      toNumber: toNumber ?? input.to ?? "",
      body: input.body,
      status: user ? "RECEIVED" : "REJECTED",
      providerMessageId: input.providerMessageId ?? undefined
    }
  });

  if (!user) {
    return "This WhatsApp number is not approved for SDA Service Request Tracker. Ask an administrator to enable WhatsApp messaging for your user account.";
  }

  const { command, rest } = splitCommand(input.body);
  const currentUser = authUser(user);

  if (!command || command === "HELP") return helpText();
  if (command === "STATUS" || command === "CHECK") return statusReply(currentUser, rest);
  if (command === "REQUEST") return createRequestFromWhatsApp(currentUser, rest);

  if (command === "APPROVE" || command === "DECLINE" || command === "RETURN") {
    const { requestNumber, comment } = splitRequestNumberAndComment(rest);
    const approvalInput = command === "APPROVE" ? splitMinuteNumberAndComment(comment) : { comment };
    return approveOrCloseRequest({
      user: currentUser,
      requestNumber,
      action: command,
      comment: approvalInput.comment,
      minuteNumber: "minuteNumber" in approvalInput ? approvalInput.minuteNumber : undefined
    });
  }

  return `Unknown command "${command}".\n\n${helpText()}`;
}
