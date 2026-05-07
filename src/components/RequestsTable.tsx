"use client";

import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Download,
  Eye,
  MapPin,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "./Badges";
import { RequestActions } from "./RequestActions";
import { Timeline } from "./Timeline";
import { formatDateRange, fromNow } from "@/lib/format";
import {
  canActOnStep,
  canCancel,
  canEscalate,
  canResubmit
} from "@/lib/permissions";
import type { ApprovalStage } from "@/lib/constants";
import type { AuthUser, RequestAccessContext } from "@/lib/types";
import type { RequestWithRelations } from "@/lib/requests";

type RequestRow = NonNullable<RequestWithRelations>;

function destinationFor(request: RequestRow) {
  return (
    request.targetChurch?.name ??
    request.targetDistrict?.name ??
    request.targetConference?.name ??
    request.targetUnion?.name ??
    "Not applicable"
  );
}

type SortKey = "request" | "status" | "type" | "church" | "date" | "updated";

const sortableColumns: Record<SortKey, string> = {
  request: "Request",
  status: "Status",
  type: "Type",
  church: "Church",
  date: "Date Required",
  updated: "Updated"
};

function accessContextForRequest(request: RequestRow): RequestAccessContext {
  return {
    requesterId: request.requesterId,
    requestingChurch: request.requestingChurch,
    targetChurch: request.targetChurch,
    targetDistrict: request.targetDistrict,
    targetConference: request.targetConference,
    targetUnion: request.targetUnion
  };
}

function currentPendingStepForRequest(request: RequestRow) {
  return request.approvalSteps.find(
    (step) => step.stepOrder === request.currentStepOrder && step.status === "PENDING"
  );
}

function requestSearchText(request: RequestRow) {
  return [
    request.title,
    request.requestNumber,
    request.status,
    request.type.name,
    request.requestingChurch.name,
    request.requestingChurch.district.name,
    request.requestingChurch.district.conference.name,
    destinationFor(request),
    request.contactPerson
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function requestSortValue(request: RequestRow, sortKey: SortKey) {
  if (sortKey === "request") return request.title.toLowerCase();
  if (sortKey === "status") return request.status;
  if (sortKey === "type") return request.type.name.toLowerCase();
  if (sortKey === "church") return request.requestingChurch.name.toLowerCase();
  if (sortKey === "date") return request.proposedDate ? new Date(request.proposedDate).getTime() : 0;
  return new Date(request.updatedAt).getTime();
}

function compareRequests(left: RequestRow, right: RequestRow, sortKey: SortKey, direction: "asc" | "desc") {
  const a = requestSortValue(left, sortKey);
  const b = requestSortValue(right, sortKey);
  const result = a > b ? 1 : a < b ? -1 : 0;
  return direction === "asc" ? result : -result;
}

export function RequestsTable({
  requests,
  dialogView = false,
  dialogPrefix = "request",
  user,
  controls = true,
  initialPageSize = 10
}: {
  requests: RequestRow[];
  dialogView?: boolean;
  dialogPrefix?: string;
  user?: AuthUser;
  controls?: boolean;
  initialPageSize?: number;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [page, setPage] = useState(1);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return requests;
    return requests.filter((request) => requestSearchText(request).includes(normalizedQuery));
  }, [query, requests]);

  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((left, right) => compareRequests(left, right, sortKey, sortDirection));
  }, [filteredRequests, sortDirection, sortKey]);

  const pageCount = Math.max(1, Math.ceil(sortedRequests.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const visibleRequests = controls ? sortedRequests.slice(start, start + pageSize) : sortedRequests;
  const visibleStart = sortedRequests.length === 0 ? 0 : start + 1;
  const visibleEnd = Math.min(start + pageSize, sortedRequests.length);

  function updateSort(nextKey: SortKey) {
    setPage(1);
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(nextKey);
    setSortDirection(nextKey === "updated" ? "desc" : "asc");
  }

  function SortHeader({ column }: { column: SortKey }) {
    return (
      <button className="sort-button" onClick={() => updateSort(column)} type="button">
        {sortableColumns[column]}
        <ChevronsUpDown size={14} aria-hidden="true" />
        {sortKey === column ? <span className="sort-direction">{sortDirection === "asc" ? "Asc" : "Desc"}</span> : null}
      </button>
    );
  }

  if (requests.length === 0) {
    return <div className="empty-state">No requests found.</div>;
  }

  return (
    <>
      {controls ? (
        <div className="table-tools">
          <div className="field table-search">
            <label htmlFor={`${dialogPrefix}-search`}>Filter</label>
            <input
              id={`${dialogPrefix}-search`}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search requests"
              type="search"
              value={query}
            />
          </div>
          <div className="field table-page-size">
            <label htmlFor={`${dialogPrefix}-page-size`}>Rows</label>
            <select
              id={`${dialogPrefix}-page-size`}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              value={pageSize}
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
          <p className="table-count">
            {visibleStart}-{visibleEnd} of {sortedRequests.length}
            {sortedRequests.length !== requests.length ? ` filtered from ${requests.length}` : ""}
          </p>
        </div>
      ) : null}

      {sortedRequests.length === 0 ? <div className="empty-state">No requests match the current filter.</div> : null}

      {sortedRequests.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <SortHeader column="request" />
                </th>
                <th>
                  <SortHeader column="status" />
                </th>
                <th>
                  <SortHeader column="type" />
                </th>
                <th>
                  <SortHeader column="church" />
                </th>
                <th>
                  <SortHeader column="date" />
                </th>
                <th>
                  <SortHeader column="updated" />
                </th>
                <th>{dialogView ? "View" : "Open"}</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.map((request) => {
                const dialogId = `${dialogPrefix}-${request.id}`;
                return (
                  <tr key={request.id}>
                    <td>
                      <div className="row-title">
                        <strong>{request.title}</strong>
                        <span className="request-number">{request.requestNumber}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>{request.type.name}</td>
                    <td>
                      <div className="row-title">
                        <span>
                          <Building2 size={14} aria-hidden="true" /> {request.requestingChurch.name}
                        </span>
                        <span className="muted">
                          <MapPin size={14} aria-hidden="true" /> {request.requestingChurch.district.name}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="table-meta">
                        <CalendarDays size={14} aria-hidden="true" />
                        {formatDateRange(request.proposedDate, request.requiredToDate)}
                      </span>
                    </td>
                    <td>{fromNow(request.updatedAt)}</td>
                    <td>
                      {dialogView ? (
                        <a className="button icon secondary" href={`#${dialogId}`} aria-label="View request dialog">
                          <Eye size={16} aria-hidden="true" />
                        </a>
                      ) : (
                        <Link className="button icon secondary" href={`/requests/${request.id}`} aria-label="Open request">
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {controls ? (
        <div className="pagination-bar">
          <button
            className="button secondary"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft size={16} aria-hidden="true" />
            Previous
          </button>
          <span>
            Page {safePage} of {pageCount}
          </span>
          <button
            className="button secondary"
            disabled={safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            type="button"
          >
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {dialogView
        ? visibleRequests.map((request) => {
            const dialogId = `${dialogPrefix}-${request.id}`;
            const context = accessContextForRequest(request);
            const pendingStep = currentPendingStepForRequest(request);
            const canAct =
              user && pendingStep
                ? canActOnStep(user, {
                    stage: pendingStep.stage as ApprovalStage,
                    status: pendingStep.status,
                    assignedScopeType: pendingStep.assignedScopeType,
                    assignedChurchId: pendingStep.assignedChurchId,
                    assignedDistrictId: pendingStep.assignedDistrictId,
                    assignedConferenceId: pendingStep.assignedConferenceId,
                    assignedUnionId: pendingStep.assignedUnionId
                  })
                : false;
            const terminal = ["APPROVED", "DECLINED", "CANCELLED"].includes(request.status);
            const nextEscalations = ["CONFERENCE", "UNION"].filter(
              (stage) => !request.approvalSteps.some((step) => step.stage === stage)
            );
            const showActions = Boolean(
              user &&
                (canAct ||
                  canCancel(user, context, request.status) ||
                  canResubmit(user, context, request.status) ||
                  request.status === "DRAFT" ||
                  (canEscalate(user, context) && !terminal && nextEscalations.length > 0))
            );
            return (
              <div
                aria-labelledby={`${dialogId}-title`}
                aria-modal="true"
                className="request-dialog"
                id={dialogId}
                key={dialogId}
                role="dialog"
              >
                <div className="request-dialog-card">
                  <div className="request-dialog-header">
                    <div>
                      <span className="request-number">{request.requestNumber}</span>
                      <h2 id={`${dialogId}-title`}>{request.title}</h2>
                      <p>{request.requestingChurch.name}</p>
                    </div>
                    <a className="button icon ghost" href="#" aria-label="Close request dialog">
                      <X size={18} aria-hidden="true" />
                    </a>
                  </div>

                  <div className="button-row request-dialog-actions">
                    <StatusBadge status={request.status} />
                    <a className="button secondary" href={`/api/requests/${request.id}/pdf`}>
                      <Download size={16} aria-hidden="true" />
                      Download PDF
                    </a>
                    <Link className="button" href={`/requests/${request.id}`}>
                      Full details
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>

                  {showActions && user ? (
                    <div className="request-dialog-approval-actions">
                      <RequestActions
                        requestId={request.id}
                        canAct={canAct}
                        canCancel={canCancel(user, context, request.status)}
                        canResubmit={canResubmit(user, context, request.status) || request.status === "DRAFT"}
                        canEscalate={canEscalate(user, context)}
                        status={request.status}
                        existingStages={request.approvalSteps.map((step) => step.stage)}
                        currentStage={pendingStep?.stage}
                        placement="top"
                      />
                    </div>
                  ) : null}

                  <div className="dialog-detail-grid">
                    <div className="detail-item">
                      <span>Service Required</span>
                      <strong>{request.serviceRequired ?? request.type.name}</strong>
                    </div>
                    <div className="detail-item">
                      <span>Date Required</span>
                      <strong>{formatDateRange(request.proposedDate, request.requiredToDate)}</strong>
                    </div>
                    <div className="detail-item">
                      <span>Target</span>
                      <strong>{destinationFor(request)}</strong>
                    </div>
                    <div className="detail-item">
                      <span>Current Stage</span>
                      <strong>{pendingStep ? pendingStep.assignedRoleGroup : "No pending approval stage"}</strong>
                    </div>
                    <div className="detail-item">
                      <span>Contact Person</span>
                      <strong>{request.contactPerson}</strong>
                    </div>
                    <div className="detail-item full">
                      <span>Event Description</span>
                      <p>{request.description}</p>
                    </div>
                  </div>

                  <div className="request-dialog-timeline">
                    <div className="request-dialog-section-header">
                      <h3>Approval Timeline</h3>
                      <p>Steps completed and the current pending stage.</p>
                    </div>
                    <Timeline steps={request.approvalSteps} currentStepOrder={request.currentStepOrder} />
                  </div>
                </div>
              </div>
            );
          })
        : null}
    </>
  );
}
