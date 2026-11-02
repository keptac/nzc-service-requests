import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LeaveApplicationsTable } from "@/components/LeaveApplicationsTable";
import { requireUser } from "@/lib/auth";
import { getVisibleLeaveApplications } from "@/lib/leave";

export const dynamic = "force-dynamic";

export default async function LeaveListPage() {
  const user = await requireUser();
  const applications = await getVisibleLeaveApplications(user);

  const rows = applications.map((application) => ({
    id: application.id,
    applicationNumber: application.applicationNumber,
    employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
    leaveTypeName: application.leaveType.name,
    startDate: application.startDate,
    endDate: application.endDate,
    totalDays: application.totalDays,
    status: application.status
  }));

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Leave Applications</h1>
            <p>{rows.length} application(s) visible to you.</p>
          </div>
          <Link className="button" href="/hr/leave/new">
            <CalendarPlus size={16} aria-hidden="true" />
            Apply for Leave
          </Link>
        </header>

        <section className="panel">
          <div className="panel-body">
            <LeaveApplicationsTable applications={rows} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
