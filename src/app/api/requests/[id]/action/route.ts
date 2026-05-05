import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { actionSchema } from "@/lib/validation";
import { accessContext, currentPendingStep, getRequestById } from "@/lib/requests";
import {
  canActOnStep,
  canCancel,
  canEscalate,
  canResubmit,
  canViewRequest
} from "@/lib/permissions";
import {
  determineApprovalPath,
  nextEscalationStage,
  nextPendingStatus,
  workflowStepForStage
} from "@/lib/workflow";
import { auditLog } from "@/lib/audit";
import { notifyNextApprovers, notifyRequester } from "@/lib/notifications";
import type { ApprovalStage } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const payload = actionSchema.safeParse(await request.json().catch(() => null));

  if (!payload.success) {
    return NextResponse.json({ error: "Invalid request action." }, { status: 400 });
  }

  const serviceRequest = await getRequestById(params.id);
  if (!serviceRequest) return NextResponse.json({ error: "Request not found." }, { status: 404 });

  const context = accessContext(serviceRequest);
  if (!canViewRequest(user, context)) {
    return NextResponse.json({ error: "You cannot access this request." }, { status: 403 });
  }

  const { action, comment, minuteNumber } = payload.data;
  const normalizedMinuteNumber = minuteNumber?.trim();

  if ((action === "DECLINE" || action === "RETURN") && !comment?.trim()) {
    return NextResponse.json({ error: "A comment is required for this action." }, { status: 400 });
  }

  if (action === "CANCEL") {
    if (!canCancel(user, context, serviceRequest.status)) {
      return NextResponse.json({ error: "You cannot cancel this request." }, { status: 403 });
    }

    await prisma.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: "CANCELLED",
        currentStepOrder: null,
        comments: comment?.trim()
          ? {
              create: {
                authorId: user.id,
                body: comment.trim()
              }
            }
          : undefined
      }
    });

    await auditLog({
      actorId: user.id,
      requestId: serviceRequest.id,
      action: "REQUEST_CANCELLED",
      entityType: "ServiceRequest",
      entityId: serviceRequest.id
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "RESUBMIT") {
    if (!canResubmit(user, context, serviceRequest.status) && serviceRequest.status !== "DRAFT") {
      return NextResponse.json({ error: "You cannot resubmit this request." }, { status: 403 });
    }

    const existingSteps = serviceRequest.approvalSteps;
    let stepsToUse = existingSteps;
    if (existingSteps.length === 0) {
      const generated = determineApprovalPath(serviceRequest.requestingChurch, {
        church: serviceRequest.targetChurch,
        district: serviceRequest.targetDistrict,
        conference: serviceRequest.targetConference,
        union: serviceRequest.targetUnion
      });
      await prisma.approvalStep.createMany({
        data: generated.map((step) => ({
          requestId: serviceRequest.id,
          ...step,
          status: "PENDING"
        }))
      });
      stepsToUse = await prisma.approvalStep.findMany({
        where: { requestId: serviceRequest.id },
        orderBy: { stepOrder: "asc" },
        include: { actedBy: true }
      });
    }

    const firstStep = stepsToUse.sort((a, b) => a.stepOrder - b.stepOrder)[0];
    await prisma.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: nextPendingStatus(firstStep.stage as ApprovalStage),
        currentStepOrder: firstStep.stepOrder,
        comments: {
          create: {
            authorId: user.id,
            body: comment?.trim() || "Request resubmitted for approval.",
            system: true
          }
        },
        approvalSteps: {
          updateMany: {
            where: { stepOrder: firstStep.stepOrder },
            data: {
              status: "PENDING",
              actedById: null,
              actedAt: null,
              comment: null,
              minuteNumber: null
            }
          }
        }
      }
    });

    await notifyNextApprovers({
      requestId: serviceRequest.id,
      requestNumber: serviceRequest.requestNumber,
      title: serviceRequest.title,
      stage: firstStep.stage as ApprovalStage,
      scope: firstStep
    });

    await auditLog({
      actorId: user.id,
      requestId: serviceRequest.id,
      action: "REQUEST_RESUBMITTED",
      entityType: "ServiceRequest",
      entityId: serviceRequest.id
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "ESCALATE") {
    if (!canEscalate(user, context)) {
      return NextResponse.json({ error: "You cannot escalate this request." }, { status: 403 });
    }

    const nextStage = nextEscalationStage(
      serviceRequest.approvalSteps.map((step) => step.stage),
      payload.data.escalateTo
    );

    if (!nextStage) {
      return NextResponse.json({ error: "This request already includes all escalation stages." }, { status: 400 });
    }

    const pendingStep = currentPendingStep(serviceRequest);
    const stepOrder = Math.max(0, ...serviceRequest.approvalSteps.map((step) => step.stepOrder)) + 1;
    const newStep = workflowStepForStage(nextStage, stepOrder, serviceRequest.requestingChurch);
    const createdStep = await prisma.approvalStep.create({
      data: {
        requestId: serviceRequest.id,
        ...newStep,
        status: "PENDING"
      }
    });

    if (!pendingStep) {
      await prisma.serviceRequest.update({
        where: { id: serviceRequest.id },
        data: {
          status: nextPendingStatus(nextStage),
          currentStepOrder: createdStep.stepOrder
        }
      });

      await notifyNextApprovers({
        requestId: serviceRequest.id,
        requestNumber: serviceRequest.requestNumber,
        title: serviceRequest.title,
        stage: nextStage,
        scope: createdStep
      });
    }

    await prisma.comment.create({
      data: {
        requestId: serviceRequest.id,
        authorId: user.id,
        body: comment?.trim() || `Request manually escalated to ${nextStage.toLowerCase()} review.`,
        system: true
      }
    });

    await auditLog({
      actorId: user.id,
      requestId: serviceRequest.id,
      action: "REQUEST_ESCALATED",
      entityType: "ServiceRequest",
      entityId: serviceRequest.id,
      metadata: { nextStage }
    });

    return NextResponse.json({ ok: true });
  }

  const step = currentPendingStep(serviceRequest);
  if (!step) {
    return NextResponse.json({ error: "There is no pending approval step." }, { status: 400 });
  }

  if (
    !canActOnStep(user, {
      stage: step.stage as ApprovalStage,
      status: step.status,
      assignedScopeType: step.assignedScopeType,
      assignedChurchId: step.assignedChurchId,
      assignedDistrictId: step.assignedDistrictId,
      assignedConferenceId: step.assignedConferenceId,
      assignedUnionId: step.assignedUnionId
    })
  ) {
    return NextResponse.json({ error: "You cannot act on the current approval step." }, { status: 403 });
  }

  if (action === "APPROVE" && step.stage === "DESTINATION" && !normalizedMinuteNumber) {
    return NextResponse.json(
      { error: "A minute number is required when the destination church accepts this request." },
      { status: 400 }
    );
  }

  if (action === "DECLINE" || action === "RETURN") {
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: action === "DECLINE" ? "DECLINED" : "RETURNED",
        actedById: user.id,
        actedAt: new Date(),
        comment: comment?.trim()
      }
    });

    const newStatus = action === "DECLINE" ? "DECLINED" : "RETURNED_FOR_CLARIFICATION";
    await prisma.serviceRequest.update({
      where: { id: serviceRequest.id },
      data: {
        status: newStatus,
        currentStepOrder: action === "DECLINE" ? null : step.stepOrder,
        comments: {
          create: {
            authorId: user.id,
            body: comment!.trim(),
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
      actorId: user.id,
      requestId: serviceRequest.id,
      action: action === "DECLINE" ? "REQUEST_DECLINED" : "REQUEST_RETURNED",
      entityType: "ServiceRequest",
      entityId: serviceRequest.id,
      metadata: { step: step.stage }
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "APPROVE") {
    await prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        status: "APPROVED",
        actedById: user.id,
        actedAt: new Date(),
        comment: comment?.trim(),
        minuteNumber: step.stage === "DESTINATION" ? normalizedMinuteNumber : undefined
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
        boardActionNumber: step.stage === "DESTINATION" ? normalizedMinuteNumber : undefined,
        currentStepOrder: nextStep?.stepOrder ?? null,
        comments: comment?.trim()
          ? {
              create: {
                authorId: user.id,
                body: comment.trim(),
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
      actorId: user.id,
      requestId: serviceRequest.id,
      action: "REQUEST_APPROVED",
      entityType: "ApprovalStep",
      entityId: step.id,
      metadata: { stage: step.stage, minuteNumber: step.stage === "DESTINATION" ? normalizedMinuteNumber : undefined }
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
