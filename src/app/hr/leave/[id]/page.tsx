import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LeaveActions } from "@/components/LeaveActions";
import { LeaveStatusBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { canApproveLeave, canCancelLeave, canViewLeave, leaveStage } from "@/lib/permissions";
import { getLeaveApplicationById, leaveAccessContext } from "@/lib/leave";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function LeaveDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const application = await getLeaveApplicationById(params.id);
  if (!application) notFound();

  const context = leaveAccessContext(application);
  if (!canViewLeave(user, context)) notFound();

  const canApprove = canApproveLeave(user, context);
  const canCancel = canCancelLeave(user, context);
  const stage = leaveStage(application.status);
  const employee = application.employee;

  const details: Array<{ label: string; value: string }> = [
    { label: "Employee", value: `${employee.firstName} ${employee.lastName}` },
    { label: "Employee number", value: employee.employeeNumber },
    { label: "Leave type", value: application.leaveType.name },
    { label: "Start date", value: formatDate(application.startDate) },
    { label: "End date", value: formatDate(application.endDate) },
    { label: "Total days", value: String(application.totalDays) },
    { label: "Submitted", value: formatDateTime(application.createdAt) }
  ];
  if (application.contactWhileAway) {
    details.push({ label: "Contact while away", value: application.contactWhileAway });
  }

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <span className="page-kicker">Leave Application</span>
            <h1>{application.applicationNumber}</h1>
            <div className="dashboard-context">
              <span>
                <LeaveStatusBadge status={application.status} />
              </span>
            </div>
          </div>
          <Link className="button secondary" href="/hr/leave">
            Back to applications
          </Link>
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Details</h2>
            </div>
          </div>
          <div className="panel-body">
            <dl className="detail-grid">
              {details.map((item) => (
                <div className="detail-item" key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
            <div className="detail-item">
              <dt>Reason</dt>
              <dd>{application.reason}</dd>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Approval Progress</h2>
              <p>Supervisor recommendation, then ADCOM minute number.</p>
            </div>
          </div>
          <div className="panel-body">
            <dl className="detail-grid">
              <div className="detail-item">
                <dt>1. Supervisor recommendation</dt>
                <dd>
                  {application.supervisorApprovedAt
                    ? `Recommended ${formatDateTime(application.supervisorApprovedAt)}`
                    : stage === "SUPERVISOR"
                      ? "Awaiting supervisor"
                      : "—"}
                </dd>
              </div>
              <div className="detail-item">
                <dt>2. ADCOM minute</dt>
                <dd>
                  {application.adcomMinuteNumber
                    ? `Minute ${application.adcomMinuteNumber}`
                    : stage === "ADCOM"
                      ? "Awaiting ADCOM minute number"
                      : "—"}
                </dd>
              </div>
              {application.decidedAt ? (
                <>
                  <div className="detail-item">
                    <dt>Final decision by</dt>
                    <dd>{application.decidedBy?.name ?? "—"}</dd>
                  </div>
                  <div className="detail-item">
                    <dt>Decided at</dt>
                    <dd>{formatDateTime(application.decidedAt)}</dd>
                  </div>
                </>
              ) : null}
            </dl>
            {application.decisionComment ? (
              <div className="detail-item">
                <dt>Comment</dt>
                <dd>{application.decisionComment}</dd>
              </div>
            ) : null}
          </div>
        </section>

        {canApprove || canCancel ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Actions</h2>
                <p>Approve, decline, return, or cancel this application.</p>
              </div>
            </div>
            <div className="panel-body">
              <LeaveActions
                applicationId={application.id}
                canApprove={canApprove}
                canCancel={canCancel}
                stage={stage}
              />
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
