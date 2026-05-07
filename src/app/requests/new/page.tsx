import { AppShell } from "@/components/AppShell";
import { RequestForm } from "@/components/RequestForm";
import { requireUser } from "@/lib/auth";
import { canAccessCreateRequest, isSuperAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveRequestSignatories } from "@/lib/signatories";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const user = await requireUser();
  const superAdmin = isSuperAdmin(user);
  const canCreate = canAccessCreateRequest(user);

  const [types, allChurches, districts, conferences, unions, signatories] = await Promise.all([
    prisma.serviceRequestType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.church.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.district.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.conference.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.union.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    user.districtId
      ? resolveRequestSignatories({ requesterId: user.id, districtId: user.districtId })
      : Promise.resolve({
          clericalOfficeName: null,
          clericalOfficePhone: null,
          districtPastorName: null,
          districtPastorPhone: null,
          preview: {
            clericalOffice: superAdmin ? "Resolved from selected church" : "Not set",
            districtPastor: superAdmin ? "Resolved from selected church" : "Not set"
          }
        })
  ]);

  const requestingChurches = superAdmin
    ? allChurches
    : allChurches.filter((church) => church.id === user.churchId);

  if (!canCreate) {
    return (
      <AppShell user={user}>
        <div className="content">
          <header className="page-header">
            <div>
              <h1>Create Service Request</h1>
              <p>Only a Church Clerk assigned to a local church can create service requests.</p>
            </div>
          </header>
          <div className="empty-state">You do not have access to create requests.</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Create Service Request</h1>
            <p>Submit a new request for approval through the correct church hierarchy.</p>
          </div>
        </header>
        <RequestForm
          user={user}
          types={types}
          requestingChurches={requestingChurches}
          churches={allChurches}
          districts={districts}
          conferences={conferences}
          unions={unions}
          signatories={signatories.preview}
        />
      </div>
    </AppShell>
  );
}
