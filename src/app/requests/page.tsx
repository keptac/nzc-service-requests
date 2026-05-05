import Link from "next/link";
import { Filter, FilePlus2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RequestsTable } from "@/components/RequestsTable";
import { requireUser } from "@/lib/auth";
import { canAccessCreateRequest } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getVisibleRequests } from "@/lib/requests";
import { REQUEST_STATUSES, STATUS_LABELS } from "@/lib/constants";

export const dynamic = "force-dynamic";

type SearchParams = {
  status?: string;
  typeId?: string;
  churchId?: string;
  districtId?: string;
  conferenceId?: string;
  from?: string;
  to?: string;
};

export default async function RequestsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser();
  const canCreate = canAccessCreateRequest(user);
  const [requests, types, churches, districts, conferences] = await Promise.all([
    getVisibleRequests(user),
    prisma.serviceRequestType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.church.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.district.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.conference.findMany({ where: { active: true }, orderBy: { name: "asc" } })
  ]);

  const filtered = requests.filter((request) => {
    if (searchParams.status && request.status !== searchParams.status) return false;
    if (searchParams.typeId && request.typeId !== searchParams.typeId) return false;
    if (
      searchParams.churchId &&
      request.requestingChurchId !== searchParams.churchId &&
      request.targetChurchId !== searchParams.churchId
    ) {
      return false;
    }
    if (
      searchParams.districtId &&
      request.requestingChurch.district.id !== searchParams.districtId &&
      request.targetChurch?.district.id !== searchParams.districtId &&
      request.targetDistrictId !== searchParams.districtId
    ) {
      return false;
    }
    if (
      searchParams.conferenceId &&
      request.requestingChurch.district.conference.id !== searchParams.conferenceId &&
      request.targetChurch?.district.conference.id !== searchParams.conferenceId &&
      request.targetDistrict?.conference.id !== searchParams.conferenceId &&
      request.targetConferenceId !== searchParams.conferenceId
    ) {
      return false;
    }
    if (searchParams.from && request.proposedDate && request.proposedDate < new Date(searchParams.from)) {
      return false;
    }
    if (searchParams.to && request.proposedDate && request.proposedDate > new Date(searchParams.to)) {
      return false;
    }
    return true;
  });

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <h1>Requests</h1>
            <p>Filter and open service requests across your authorized hierarchy.</p>
          </div>
          {canCreate ? (
            <Link className="button" href="/requests/new">
              <FilePlus2 size={16} aria-hidden="true" />
              Create Service Request
            </Link>
          ) : null}
        </header>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>
                <Filter size={18} aria-hidden="true" /> Filters
              </h2>
              <p>Status, type, hierarchy, and proposed date filters.</p>
            </div>
          </div>
          <div className="panel-body">
            <form className="filters">
              <div className="field">
                <label htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={searchParams.status ?? ""}>
                  <option value="">All</option>
                  {REQUEST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="typeId">Type</label>
                <select id="typeId" name="typeId" defaultValue={searchParams.typeId ?? ""}>
                  <option value="">All</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="churchId">Church</label>
                <select id="churchId" name="churchId" defaultValue={searchParams.churchId ?? ""}>
                  <option value="">All</option>
                  {churches.map((church) => (
                    <option key={church.id} value={church.id}>
                      {church.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="districtId">District</label>
                <select id="districtId" name="districtId" defaultValue={searchParams.districtId ?? ""}>
                  <option value="">All</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="conferenceId">Conference</label>
                <select
                  id="conferenceId"
                  name="conferenceId"
                  defaultValue={searchParams.conferenceId ?? ""}
                >
                  <option value="">All</option>
                  {conferences.map((conference) => (
                    <option key={conference.id} value={conference.id}>
                      {conference.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="from">From</label>
                <input id="from" name="from" type="date" defaultValue={searchParams.from ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="to">To</label>
                <input id="to" name="to" type="date" defaultValue={searchParams.to ?? ""} />
              </div>
              <div className="button-row">
                <button className="button info" type="submit">
                  Apply
                </button>
                <Link className="button secondary" href="/requests">
                  Clear
                </Link>
              </div>
            </form>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Results</h2>
              <p>{filtered.length} request(s) found.</p>
            </div>
          </div>
          <div className="panel-body">
            <RequestsTable requests={filtered} dialogView dialogPrefix="requests-page-request" user={user} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
