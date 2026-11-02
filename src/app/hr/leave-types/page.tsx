import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LeaveTypeManager } from "@/components/LeaveTypeManager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageHrConfig } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function LeaveTypesPage() {
  const user = await requireUser();
  if (!canManageHrConfig(user)) redirect("/hr");

  const leaveTypes = await prisma.leaveType.findMany({ orderBy: { name: "asc" } });

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Leave Types</h1>
            <p>Configure leave categories and default annual entitlements.</p>
          </div>
        </header>
        <section className="entity-section">
          <div className="entity-header">
            <div>
              <h2>Leave Types</h2>
              <p>Default days seed each employee&apos;s yearly balance.</p>
            </div>
          </div>
          <LeaveTypeManager
            leaveTypes={leaveTypes.map((type) => ({
              id: type.id,
              name: type.name,
              code: type.code,
              defaultAnnualDays: type.defaultAnnualDays,
              paid: type.paid,
              requiresApproval: type.requiresApproval,
              active: type.active
            }))}
          />
        </section>
      </div>
    </AppShell>
  );
}
