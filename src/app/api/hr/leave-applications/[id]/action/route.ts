import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { leaveActionSchema } from "@/lib/validation";
import { canApproveLeave, canCancelLeave, leaveStage } from "@/lib/permissions";
import { ensureBalance, getLeaveApplicationById, leaveAccessContext } from "@/lib/leave";
import { HR_CONFIG_ROLES, HR_ROLES } from "@/lib/constants";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const user = await requireUser();
  const application = await getLeaveApplicationById(params.id);
  if (!application) {
    return NextResponse.json({ error: "Leave application not found." }, { status: 404 });
  }

  const payload = leaveActionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }
  const { action, comment, minuteNumber } = payload.data;

  const context = leaveAccessContext(application);
  const stage = leaveStage(application.status); // "SUPERVISOR" | "ADCOM" | null
  const allowed =
    action === "CANCEL" ? canCancelLeave(user, context) : canApproveLeave(user, context);
  if (!allowed) {
    return NextResponse.json({ error: "You cannot perform this action." }, { status: 403 });
  }

  if ((action === "DECLINE" || action === "RETURN") && !comment?.trim()) {
    return NextResponse.json(
      { error: "A comment is required to decline or return an application." },
      { status: 400 }
    );
  }

  // A supervisor APPROVE only recommends (moves to ADCOM); the ADCOM APPROVE is
  // the final step and requires the ADCOM minute number.
  const isFinalApproval = action === "APPROVE" && stage === "ADCOM";
  const isSupervisorApproval = action === "APPROVE" && stage === "SUPERVISOR";
  if (isFinalApproval && !minuteNumber?.trim()) {
    return NextResponse.json(
      { error: "An ADCOM minute number is required for final approval." },
      { status: 400 }
    );
  }

  const nextStatus =
    action === "APPROVE"
      ? isSupervisorApproval
        ? "RECOMMENDED"
        : "APPROVED"
      : action === "DECLINE"
        ? "DECLINED"
        : action === "RETURN"
          ? "RETURNED"
          : "CANCELLED";

  const year = new Date(application.startDate).getFullYear();
  const balance = await ensureBalance(application.employeeId, application.leaveTypeId, year);
  const releasesHold = nextStatus === "DECLINED" || nextStatus === "RETURNED" || nextStatus === "CANCELLED";

  await prisma.$transaction(async (tx) => {
    await tx.leaveApplication.update({
      where: { id: application.id },
      data: {
        status: nextStatus,
        // Supervisor recommendation stamps its own timestamp; ADCOM records the minute + final decision.
        supervisorApprovedAt: isSupervisorApproval ? new Date() : application.supervisorApprovedAt,
        adcomMinuteNumber: isFinalApproval ? minuteNumber!.trim() : application.adcomMinuteNumber,
        decidedById: isSupervisorApproval || action === "CANCEL" ? application.decidedById : user.id,
        decidedAt: isSupervisorApproval || action === "CANCEL" ? application.decidedAt : new Date(),
        decisionComment: comment?.trim() || application.decisionComment
      }
    });

    if (nextStatus === "APPROVED") {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: {
          pendingDays: { decrement: application.totalDays },
          usedDays: { increment: application.totalDays }
        }
      });
      await tx.employee.update({
        where: { id: application.employeeId },
        data: { status: "ON_LEAVE" }
      });
    } else if (releasesHold) {
      await tx.leaveBalance.update({
        where: { id: balance.id },
        data: { pendingDays: { decrement: application.totalDays } }
      });
    }
    // RECOMMENDED keeps the pending hold in place until ADCOM decides.
  });

  await auditLog({
    actorId: user.id,
    action: isSupervisorApproval ? "HR_LEAVE_RECOMMENDED" : `HR_LEAVE_${nextStatus}`,
    entityType: "leaveApplication",
    entityId: application.id,
    metadata: {
      applicationNumber: application.applicationNumber,
      ...(isFinalApproval ? { adcomMinuteNumber: minuteNumber!.trim() } : {})
    }
  });

  // Notify the right audience for the new state.
  if (isSupervisorApproval) {
    // Recommendation done → alert ADCOM approvers in scope (and central HR).
    const scopeFilter =
      application.approverScopeType === "CHURCH"
        ? { churchId: application.approverChurchId }
        : application.approverScopeType === "DISTRICT"
          ? { districtId: application.approverDistrictId }
          : application.approverScopeType === "CONFERENCE"
            ? { conferenceId: application.approverConferenceId }
            : { unionId: application.approverUnionId };
    const adcom = await prisma.user.findMany({
      where: {
        active: true,
        OR: [
          { role: { name: { in: HR_CONFIG_ROLES } } },
          { role: { name: { in: HR_ROLES } }, ...scopeFilter }
        ]
      },
      select: { id: true }
    });
    const recipients = [...adcom.map((item) => item.id)];
    if (application.employee.userId) recipients.push(application.employee.userId);
    await notifyUsers({
      userIds: recipients,
      title: `ADCOM minute needed: ${application.applicationNumber}`,
      body: `${application.employee.firstName} ${application.employee.lastName}'s ${application.leaveType.name} was recommended and awaits an ADCOM minute number.`
    });
  } else if (application.employee.userId) {
    // Final decision / cancel → notify the applicant.
    await notifyUsers({
      userIds: [application.employee.userId],
      title: `Leave ${nextStatus.toLowerCase().replace(/_/g, " ")}: ${application.applicationNumber}`,
      body: `Your ${application.leaveType.name} request is now ${nextStatus.toLowerCase().replace(/_/g, " ")}${
        comment?.trim() ? `: ${comment.trim()}` : "."
      }`
    });
  }

  return NextResponse.json({ id: application.id, status: nextStatus });
}
