import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { LeaveApplicationForm } from "@/components/LeaveApplicationForm";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageHrConfig } from "@/lib/permissions";
import { ensureBalance, remainingDays } from "@/lib/leave";

export const dynamic = "force-dynamic";

export default async function NewLeavePage() {
  const user = await requireUser();
  const isHrManager = canManageHrConfig(user);

  const leaveTypes = await prisma.leaveType.findMany({
    where: { active: true },
    orderBy: { name: "asc" }
  });

  const employee = await prisma.employee.findUnique({ where: { userId: user.id } });

  // Build remaining-balance hints for the applicant's own record.
  const balances: Record<string, number> = {};
  if (employee) {
    const year = new Date().getFullYear();
    for (const leaveType of leaveTypes) {
      const balance = await ensureBalance(employee.id, leaveType.id, year);
      balances[leaveType.id] = remainingDays(balance);
    }
  }

  // HR managers may file on behalf of any employee.
  const employeeOptions = isHrManager
    ? (
        await prisma.employee.findMany({
          where: { status: "ACTIVE" },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
        })
      ).map((item) => ({
        id: item.id,
        label: `${item.firstName} ${item.lastName} (${item.employeeNumber})`
      }))
    : undefined;

  const canApply = isHrManager || Boolean(employee);

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Apply for Leave</h1>
            <p>Submit a leave request for hierarchy-based approval.</p>
          </div>
          <Link className="button secondary" href="/hr/leave">
            Back to applications
          </Link>
        </header>

        <section className="panel">
          <div className="panel-body">
            {leaveTypes.length === 0 ? (
              <div className="empty-state">No active leave types are configured. Contact HR.</div>
            ) : !canApply ? (
              <div className="empty-state">
                No employee record is linked to your account. Ask HR to create one before applying.
              </div>
            ) : (
              <LeaveApplicationForm
                leaveTypes={leaveTypes.map((type) => ({ id: type.id, name: type.name, paid: type.paid }))}
                employees={employeeOptions}
                balances={employee ? balances : undefined}
              />
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
