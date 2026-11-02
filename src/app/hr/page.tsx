import Link from "next/link";
import { CalendarClock, CalendarPlus, ClipboardCheck, UserCog, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { LeaveApplicationsTable } from "@/components/LeaveApplicationsTable";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessHr, canManageHrConfig } from "@/lib/permissions";
import {
  getVisibleLeaveApplications,
  leaveApplicationsAwaitingUser,
  remainingDays
} from "@/lib/leave";

export const dynamic = "force-dynamic";

function toRow(application: Awaited<ReturnType<typeof getVisibleLeaveApplications>>[number]) {
  return {
    id: application.id,
    applicationNumber: application.applicationNumber,
    employeeName: `${application.employee.firstName} ${application.employee.lastName}`,
    leaveTypeName: application.leaveType.name,
    startDate: application.startDate,
    endDate: application.endDate,
    totalDays: application.totalDays,
    status: application.status
  };
}

export default async function HrPage() {
  const user = await requireUser();
  const applications = await getVisibleLeaveApplications(user, { take: 200 });
  const awaiting = leaveApplicationsAwaitingUser(user, applications);

  const employee = await prisma.employee.findUnique({
    where: { userId: user.id },
    include: { leaveBalances: { include: { leaveType: true } } }
  });
  const year = new Date().getFullYear();
  const myBalances = (employee?.leaveBalances ?? []).filter((balance) => balance.year === year);
  const myRemaining = myBalances.reduce((total, balance) => total + remainingDays(balance), 0);

  const today = new Date();
  const onLeaveToday = applications.filter(
    (application) =>
      application.status === "APPROVED" &&
      new Date(application.startDate) <= today &&
      new Date(application.endDate) >= today
  ).length;
  const employeeCount = canAccessHr(user) ? await prisma.employee.count() : null;

  const summaryCards = [
    employeeCount !== null
      ? { label: "Employees", value: employeeCount, icon: Users, tone: "ming", helper: "On record" }
      : null,
    { label: "Awaiting my approval", value: awaiting.length, icon: ClipboardCheck, tone: "denim", helper: "Leave to review" },
    { label: "On leave today", value: onLeaveToday, icon: CalendarClock, tone: "forest", helper: "Currently away" },
    {
      label: "My remaining days",
      value: myRemaining,
      icon: CalendarPlus,
      tone: "gold",
      helper: employee ? `For ${year}` : "No employee record"
    }
  ].filter(Boolean) as Array<{
    label: string;
    value: number;
    icon: typeof Users;
    tone: string;
    helper: string;
  }>;

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <span className="page-kicker">Human Resources</span>
            <h1>HR &amp; Leave</h1>
            <p>Apply for leave, review applications, and track balances across your hierarchy.</p>
          </div>
          <div className="dashboard-hero-actions">
            <Link className="button" href="/hr/leave/new">
              <CalendarPlus size={16} aria-hidden="true" />
              Apply for Leave
            </Link>
            <Link className="button secondary" href="/hr/leave">
              All Applications
            </Link>
          </div>
        </header>

        <section className="summary-grid dashboard-summary" aria-label="HR summary">
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

        {canManageHrConfig(user) ? (
          <section className="panel">
            <div className="panel-header">
              <div className="panel-heading">
                <span className="panel-icon tone-denim">
                  <UserCog size={18} aria-hidden="true" />
                </span>
                <div>
                  <h2>HR Administration</h2>
                  <p>Manage employees, leave types, and entitlements.</p>
                </div>
              </div>
            </div>
            <div className="panel-body">
              <div className="button-row">
                <Link className="button secondary" href="/hr/employees">
                  <Users size={16} aria-hidden="true" />
                  Employees
                </Link>
                <Link className="button secondary" href="/hr/leave-types">
                  Leave Types
                </Link>
                <Link className="button secondary" href="/hr/tracking">
                  <CalendarClock size={16} aria-hidden="true" />
                  Tracking
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <span className="panel-icon tone-ming">
                <ClipboardCheck size={18} aria-hidden="true" />
              </span>
              <div>
                <h2>Leave Awaiting My Approval</h2>
                <p>Applications routed to your role and scope.</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <LeaveApplicationsTable applications={awaiting.map(toRow)} />
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div className="panel-heading">
              <span className="panel-icon tone-forest">
                <CalendarClock size={18} aria-hidden="true" />
              </span>
              <div>
                <h2>Recent Applications</h2>
                <p>Latest leave activity you can see.</p>
              </div>
            </div>
          </div>
          <div className="panel-body">
            <LeaveApplicationsTable applications={applications.slice(0, 25).map(toRow)} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
