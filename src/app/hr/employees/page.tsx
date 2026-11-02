import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { EmployeeManager } from "@/components/EmployeeManager";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canManageHrConfig } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await requireUser();
  if (!canManageHrConfig(user)) redirect("/hr");

  const [employees, unions, conferences, districts, churches, users, leaveTypes] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: { user: true, supervisor: true }
    }),
    prisma.union.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.conference.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.district.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.church.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.leaveType.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Employees</h1>
            <p>Maintain the employee directory and per-year leave entitlements.</p>
          </div>
        </header>
        <section className="entity-section">
          <EmployeeManager
            employees={employees.map((employee) => ({
              id: employee.id,
              employeeNumber: employee.employeeNumber,
              firstName: employee.firstName,
              lastName: employee.lastName,
              jobTitle: employee.jobTitle,
              department: employee.department,
              status: employee.status,
              linkedUser: employee.user?.name ?? null,
              supervisorName: employee.supervisor
                ? `${employee.supervisor.firstName} ${employee.supervisor.lastName}`
                : null
            }))}
            unions={unions.map((item) => ({ id: item.id, name: item.name }))}
            conferences={conferences.map((item) => ({ id: item.id, name: item.name }))}
            districts={districts.map((item) => ({ id: item.id, name: item.name }))}
            churches={churches.map((item) => ({ id: item.id, name: item.name }))}
            users={users.map((item) => ({ id: item.id, name: `${item.name} (${item.email})` }))}
            supervisors={employees.map((item) => ({
              id: item.id,
              name: `${item.firstName} ${item.lastName} (${item.employeeNumber})`
            }))}
            leaveTypes={leaveTypes.map((item) => ({ id: item.id, name: item.name }))}
            currentYear={new Date().getFullYear()}
          />
        </section>
      </div>
    </AppShell>
  );
}
