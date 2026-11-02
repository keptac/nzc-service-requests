import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LeaveStatusBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessHr } from "@/lib/permissions";
import { getVisibleEmployees, getVisibleLeaveApplications, remainingDays } from "@/lib/leave";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const user = await requireUser();
  if (!canAccessHr(user)) redirect("/hr");

  const year = new Date().getFullYear();
  const today = new Date();

  const employees = await getVisibleEmployees(user);
  const employeeIds = employees.map((employee) => employee.id);

  const balances = await prisma.leaveBalance.findMany({
    where: { year, employeeId: { in: employeeIds } },
    include: { employee: true, leaveType: true },
    orderBy: [{ employee: { lastName: "asc" } }]
  });

  const applications = await getVisibleLeaveApplications(user);
  const onLeave = applications.filter(
    (application) =>
      application.status === "APPROVED" &&
      new Date(application.startDate) <= today &&
      new Date(application.endDate) >= today
  );
  const upcoming = applications.filter(
    (application) => application.status === "APPROVED" && new Date(application.startDate) > today
  );

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Leave Tracking</h1>
            <p>Balances for {year}, current and upcoming leave.</p>
          </div>
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Currently On Leave</h2>
              <p>{onLeave.length} employee(s) away today.</p>
            </div>
          </div>
          <div className="panel-body">
            {onLeave.length === 0 ? (
              <div className="empty-state">No one is on leave today.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onLeave.map((application) => (
                      <tr key={application.id}>
                        <td>
                          {application.employee.firstName} {application.employee.lastName}
                        </td>
                        <td>{application.leaveType.name}</td>
                        <td>{formatDate(application.startDate)}</td>
                        <td>{formatDate(application.endDate)}</td>
                        <td>{application.totalDays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Upcoming Leave</h2>
              <p>{upcoming.length} approved future application(s).</p>
            </div>
          </div>
          <div className="panel-body">
            {upcoming.length === 0 ? (
              <div className="empty-state">No upcoming leave.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Type</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((application) => (
                      <tr key={application.id}>
                        <td>
                          {application.employee.firstName} {application.employee.lastName}
                        </td>
                        <td>{application.leaveType.name}</td>
                        <td>{formatDate(application.startDate)}</td>
                        <td>{formatDate(application.endDate)}</td>
                        <td>
                          <LeaveStatusBadge status={application.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Leave Balances ({year})</h2>
              <p>Entitled, used, pending, and remaining days per employee.</p>
            </div>
          </div>
          <div className="panel-body">
            {balances.length === 0 ? (
              <div className="empty-state">No balances recorded yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Leave type</th>
                      <th>Entitled</th>
                      <th>Carried</th>
                      <th>Used</th>
                      <th>Pending</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr key={balance.id}>
                        <td>
                          {balance.employee.firstName} {balance.employee.lastName}
                        </td>
                        <td>{balance.leaveType.name}</td>
                        <td>{balance.entitledDays}</td>
                        <td>{balance.carriedOverDays}</td>
                        <td>{balance.usedDays}</td>
                        <td>{balance.pendingDays}</td>
                        <td>
                          <strong>{remainingDays(balance)}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
