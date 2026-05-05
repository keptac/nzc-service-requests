import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/Badges";
import { RequestsTable } from "@/components/RequestsTable";
import { requireUser } from "@/lib/auth";
import { getVisibleRequests } from "@/lib/requests";
import { REQUEST_STATUSES, STATUS_LABELS } from "@/lib/constants";
import { stageDisplayName } from "@/lib/workflow";

export const dynamic = "force-dynamic";

function groupCount<T extends string>(items: T[]) {
  return items.reduce<Record<string, number>>((accumulator, item) => {
    accumulator[item] = (accumulator[item] ?? 0) + 1;
    return accumulator;
  }, {});
}

function averageApprovalHours(requests: Awaited<ReturnType<typeof getVisibleRequests>>) {
  const approved = requests
    .filter((request) => request.status === "APPROVED")
    .map((request) => {
      const actedDates = request.approvalSteps
        .map((step) => step.actedAt?.getTime())
        .filter((value): value is number => Boolean(value));
      if (actedDates.length === 0) return null;
      return (Math.max(...actedDates) - request.createdAt.getTime()) / 36e5;
    })
    .filter((value): value is number => value !== null);

  if (approved.length === 0) return 0;
  return Math.round(approved.reduce((total, hours) => total + hours, 0) / approved.length);
}

export default async function ReportsPage() {
  const user = await requireUser();
  const requests = await getVisibleRequests(user);

  const byStatus = groupCount(requests.map((request) => request.status));
  const byChurch = groupCount(requests.map((request) => request.requestingChurch.name));
  const byDistrict = groupCount(requests.map((request) => request.requestingChurch.district.name));
  const byConference = groupCount(
    requests.map((request) => request.requestingChurch.district.conference.name)
  );
  const pendingByStage = groupCount(
    requests
      .filter((request) => request.status.startsWith("PENDING"))
      .map((request) => request.approvalSteps.find((step) => step.stepOrder === request.currentStepOrder)?.stage ?? "UNKNOWN")
  );
  const declined = requests.filter((request) => request.status === "DECLINED");
  const averageHours = averageApprovalHours(requests);
  const maxCount = Math.max(1, ...Object.values(byStatus), ...Object.values(byChurch), ...Object.values(byDistrict));

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Reports</h1>
            <p>Operational summaries for the requests visible to your role.</p>
          </div>
        </header>

        <section className="summary-grid">
          <div className="summary-card">
            <span>Total Requests</span>
            <strong>{requests.length}</strong>
          </div>
          <div className="summary-card">
            <span>Pending Requests</span>
            <strong>{requests.filter((request) => request.status.startsWith("PENDING")).length}</strong>
          </div>
          <div className="summary-card">
            <span>Declined Requests</span>
            <strong>{declined.length}</strong>
          </div>
          <div className="summary-card">
            <span>Average Approval Time</span>
            <strong>{averageHours}h</strong>
          </div>
        </section>

        <section className="report-grid">
          <ReportCard title="Requests by Status" counts={byStatus} maxCount={maxCount} status />
          <ReportCard title="Requests by Church" counts={byChurch} maxCount={maxCount} />
          <ReportCard title="Requests by District" counts={byDistrict} maxCount={maxCount} />
          <ReportCard title="Requests by Conference" counts={byConference} maxCount={maxCount} />
          <ReportCard
            title="Pending by Stage"
            counts={Object.fromEntries(
              Object.entries(pendingByStage).map(([stage, count]) => [stageDisplayName(stage), count])
            )}
            maxCount={maxCount}
          />
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Declined Requests</h2>
              <p>Requests where the workflow has ended with a decline.</p>
            </div>
          </div>
          <div className="panel-body">
            <RequestsTable requests={declined} dialogPrefix="declined-report-request" />
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ReportCard({
  title,
  counts,
  maxCount,
  status = false
}: {
  title: string;
  counts: Record<string, number>;
  maxCount: number;
  status?: boolean;
}) {
  const entries =
    status
      ? REQUEST_STATUSES.map((item) => [item, counts[item] ?? 0] as const)
      : Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="panel-body">
        {entries.length === 0 ? (
          <div className="empty-state">No data.</div>
        ) : (
          <div className="bar-list">
            {entries.map(([label, count]) => (
              <div className="bar-item" key={label}>
                <div className="bar-meta">
                  {status ? (
                    <StatusBadge status={label} />
                  ) : (
                    <span>{STATUS_LABELS[label as keyof typeof STATUS_LABELS] ?? label}</span>
                  )}
                  <strong>{count}</strong>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
