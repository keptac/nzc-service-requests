import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { createLeaveApplicationSchema } from "@/lib/validation";
import { canApplyForLeave, canManageHrConfig } from "@/lib/permissions";
import {
  countLeaveDays,
  ensureBalance,
  getVisibleLeaveApplications,
  nextApplicationNumber,
  remainingDays,
  resolveApproverScope
} from "@/lib/leave";
import { HR_CONFIG_ROLES } from "@/lib/constants";

export async function GET() {
  const user = await requireUser();
  const applications = await getVisibleLeaveApplications(user, { take: 200 });
  return NextResponse.json({ applications });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canApplyForLeave(user)) {
    return NextResponse.json({ error: "You cannot apply for leave." }, { status: 403 });
  }

  const payload = createLeaveApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid leave application." }, { status: 400 });
  }
  const data = payload.data;

  // HR managers may file on behalf of any employee; everyone else files for their own record.
  let employee;
  const employeeInclude = { supervisor: { include: { user: true } } };
  if (data.employeeId && canManageHrConfig(user)) {
    employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, include: employeeInclude });
  } else {
    employee = await prisma.employee.findUnique({ where: { userId: user.id }, include: employeeInclude });
  }
  if (!employee) {
    return NextResponse.json(
      { error: "No employee record is linked to this application." },
      { status: 400 }
    );
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { id: data.leaveTypeId } });
  if (!leaveType || !leaveType.active) {
    return NextResponse.json({ error: "Unknown or inactive leave type." }, { status: 400 });
  }

  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const totalDays = countLeaveDays(start, end);
  if (totalDays <= 0) {
    return NextResponse.json(
      { error: "The end date must be on or after the start date." },
      { status: 400 }
    );
  }

  const year = start.getFullYear();
  const balance = await ensureBalance(employee.id, leaveType.id, year);

  // Enforce balance only for paid, entitlement-bearing leave types.
  if (leaveType.paid && balance.entitledDays > 0) {
    const available = remainingDays(balance);
    if (totalDays > available) {
      return NextResponse.json(
        { error: `Insufficient balance: ${available} day(s) available, ${totalDays} requested.` },
        { status: 400 }
      );
    }
  }

  const approverScope = resolveApproverScope(employee);
  const supervisorUserId = employee.supervisor?.user?.id ?? null;
  const applicationNumber = await nextApplicationNumber();

  const created = await prisma.$transaction(async (tx) => {
    const application = await tx.leaveApplication.create({
      data: {
        applicationNumber,
        employeeId: employee.id,
        leaveTypeId: leaveType.id,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason,
        contactWhileAway: data.contactWhileAway || null,
        status: "SUBMITTED",
        supervisorUserId,
        ...approverScope
      }
    });
    await tx.leaveBalance.update({
      where: { id: balance.id },
      data: { pendingDays: { increment: totalDays } }
    });
    return application;
  });

  await auditLog({
    actorId: user.id,
    action: "HR_LEAVE_APPLIED",
    entityType: "leaveApplication",
    entityId: created.id,
    metadata: { applicationNumber, totalDays, leaveType: leaveType.code }
  });

  // Stage 1 goes to the employee's supervisor. With no supervisor on record it
  // falls back to HR managers so the application is not stranded.
  let recipientIds: string[];
  if (supervisorUserId) {
    recipientIds = [supervisorUserId];
  } else {
    const hrManagers = await prisma.user.findMany({
      where: { active: true, role: { name: { in: HR_CONFIG_ROLES } } },
      select: { id: true }
    });
    recipientIds = hrManagers.map((manager) => manager.id);
  }

  await notifyUsers({
    userIds: recipientIds,
    title: `Leave recommendation needed: ${applicationNumber}`,
    body: `${employee.firstName} ${employee.lastName} requested ${totalDays} day(s) of ${leaveType.name}.`
  });

  return NextResponse.json({ id: created.id, applicationNumber }, { status: 201 });
}
