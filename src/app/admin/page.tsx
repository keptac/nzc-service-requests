import { AppShell } from "@/components/AppShell";
import { AdminPanel } from "@/components/AdminPanel";
import { requireSuperAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireSuperAdmin();
  const [unions, conferences, districts, churches, users, roles, requestTypes] = await Promise.all([
    prisma.union.findMany({ orderBy: { name: "asc" } }),
    prisma.conference.findMany({ orderBy: { name: "asc" }, include: { union: true } }),
    prisma.district.findMany({ orderBy: { name: "asc" }, include: { conference: true } }),
    prisma.church.findMany({ orderBy: { name: "asc" }, include: { district: true } }),
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: {
        role: true,
        union: true,
        conference: true,
        district: true,
        church: true
      }
    }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.serviceRequestType.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Admin Management</h1>
            <p>Manage hierarchy entities, users, roles, and service request types.</p>
          </div>
        </header>
        <AdminPanel
          unions={unions}
          conferences={conferences}
          districts={districts}
          churches={churches}
          users={users}
          roles={roles}
          requestTypes={requestTypes}
        />
      </div>
    </AppShell>
  );
}
