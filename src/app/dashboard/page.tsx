import Link from "next/link";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FilePlus2,
  Inbox,
  ShieldCheck,
  XCircle
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequestsTable } from "@/components/RequestsTable";
import { StatusBadge } from "@/components/Badges";
import { requireUser } from "@/lib/auth";
import { canAccessCreateRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getVisibleRequests, requestsAwaitingUser } from "@/lib/requests";
import { STATUS_LABELS, type RequestStatus } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const requests = await getVisibleRequests(user, { take: 80 });
  const awaiting = requestsAwaitingUser(user, requests);
  const submitted = requests.filter((request) => request.requesterId === user.id).slice(0, 5);
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 5,
    include: { request: true }
  });

  const counts = requests.reduce<Record<string, number>>((accumulator, request) => {
    accumulator[request.status] = (accumulator[request.status] ?? 0) + 1;
    return accumulator;
  }, {});
  const pendingCount = requests.filter((request) => request.status.startsWith("PENDING")).length;
  const approvedCount = counts.APPROVED ?? 0;
  const declinedCount = counts.DECLINED ?? 0;
  const maxStatusCount = Math.max(1, ...Object.values(counts));
  const canCreate = canAccessCreateRequest(user);

  const summaryCards = [
    {
      label: "Awaiting my action",
      value: awaiting.length,
      icon: ClipboardCheck,
      tone: "ming",
      helper: awaiting.length === 1 ? "Request ready for review" : "Requests ready for review"
    },
    {
      label: "Pending",
      value: pendingCount,
      icon: Clock3,
      tone: "denim",
      helper: "Currently in approval stages"
    },
    { label: "Approved", value: approvedCount, icon: CheckCircle2, tone: "forest", helper: "Completed successfully" },
    { label: "Declined", value: declinedCount, icon: XCircle, tone: "red", helper: "Ended without approval" }
  ];

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="dashboard-hero">
          <div className="dashboard-hero-copy">
            <span className="page-kicker">Dashboard</span>
            <h1>Welcome, {user.name}</h1>
            <p>Requests relevant to your assigned role and church hierarchy.</p>
            <div className="dashboard-context" aria-label="Dashboard context">
              <span>
                <ShieldCheck size={15} aria-hidden="true" />
                {user.roleName}
              </span>
              <span>
                <Inbox size={15} aria-hidden="true" />
                {requests.length} visible requests
              </span>
              <span>
                <Bell size={15} aria-hidden="true" />
                {notifications.length} recent updates
              </span>
            </div>
          </div>
          <div className="dashboard-hero-actions">
            {canCreate ? (
              <Link className="button" href="/requests/new">
                <FilePlus2 size={16} aria-hidden="true" />
                Create Service Request
              </Link>
            ) : null}
            <Link className="button secondary" href="/requests">
              View Requests
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="summary-grid dashboard-summary" aria-label="Request status summary">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div className={`summary-card dashboard-stat tone-${card.tone}`} key={card.label}>
                <div className="stat-topline">
                  <span>{card.label}</span>
                  <div className="summary-icon">
                    <Icon size={18} aria-hidden="true" />
                  </div>
                </div>
                <strong>{card.value}</strong>
                <small>{card.helper}</small>
              </div>
            );
          })}
        </section>

        <section className="dashboard-workspace">
          <div className="dashboard-primary">
            <section className="panel dashboard-panel action-panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <span className="panel-icon tone-ming">
                    <ClipboardCheck size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Requests Awaiting My Action</h2>
                    <p>Current pending stages assigned to your role and level.</p>
                  </div>
                </div>
                <Link className="panel-link" href="/requests">
                  View queue
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
              <div className="panel-body dashboard-table-body">
                <RequestsTable requests={awaiting.slice(0, 5)} controls={false} />
              </div>
            </section>

            <section className="panel dashboard-panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <span className="panel-icon tone-forest">
                    <FilePlus2 size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>My Submitted Requests</h2>
                    <p>Your latest submissions.</p>
                  </div>
                </div>
              </div>
              <div className="panel-body dashboard-table-body">
                <RequestsTable requests={submitted} controls={false} />
              </div>
            </section>
          </div>

          <aside className="dashboard-rail">
            <section className="panel dashboard-panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <span className="panel-icon tone-gold">
                    <Bell size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Notifications</h2>
                    <p>Recent in-app updates.</p>
                  </div>
                </div>
              </div>
              <div className="panel-body">
                {notifications.length === 0 ? (
                  <div className="empty-state">No notifications.</div>
                ) : (
                  <div className="notification-list">
                    {notifications.map((notification) => (
                      <Link
                        className="notification-card"
                        href={notification.requestId ? `/requests/${notification.requestId}` : "/dashboard"}
                        key={notification.id}
                      >
                        <span className="notification-dot">
                          <Bell size={14} aria-hidden="true" />
                        </span>
                        <div>
                          <strong>{notification.title}</strong>
                          <p>{notification.body}</p>
                          <small>{formatDateTime(notification.createdAt)}</small>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="panel dashboard-panel">
              <div className="panel-header">
                <div className="panel-heading">
                  <span className="panel-icon tone-denim">
                    <Clock3 size={18} aria-hidden="true" />
                  </span>
                  <div>
                    <h2>Status Snapshot</h2>
                    <p>Visible requests by status.</p>
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <div className="bar-list status-snapshot">
                  {Object.entries(STATUS_LABELS).map(([status]) => (
                    <div className="bar-item" key={status}>
                      <div className="bar-meta">
                        <StatusBadge status={status as RequestStatus} />
                        <strong>{counts[status] ?? 0}</strong>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${((counts[status] ?? 0) / maxStatusCount) * 100}%`
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        </section>

      </div>
    </AppShell>
  );
}
