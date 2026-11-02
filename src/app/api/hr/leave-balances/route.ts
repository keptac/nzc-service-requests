import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { auditLog } from "@/lib/audit";
import { leaveBalanceSchema } from "@/lib/validation";
import { canManageHrConfig } from "@/lib/permissions";

export async function POST(request: Request) {
  const user = await requireUser();
  if (!canManageHrConfig(user)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const payload = leaveBalanceSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid balance data." }, { status: 400 });
  }
  const { employeeId, leaveTypeId, year, entitledDays, carriedOverDays } = payload.data;

  const balance = await prisma.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    update: { entitledDays, carriedOverDays: carriedOverDays ?? undefined },
    create: { employeeId, leaveTypeId, year, entitledDays, carriedOverDays: carriedOverDays ?? 0 }
  });

  await auditLog({
    actorId: user.id,
    action: "HR_BALANCE_SET",
    entityType: "leaveBalance",
    entityId: balance.id,
    metadata: { employeeId, leaveTypeId, year, entitledDays }
  });

  return NextResponse.json({ id: balance.id });
}
