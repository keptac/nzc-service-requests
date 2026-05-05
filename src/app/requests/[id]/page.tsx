import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Download, Paperclip } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge, PriorityBadge } from "@/components/Badges";
import { Timeline } from "@/components/Timeline";
import { CommentsThread } from "@/components/CommentsThread";
import { RequestActions } from "@/components/RequestActions";
import { requireUser } from "@/lib/auth";
import { accessContext, currentPendingStep, getRequestById } from "@/lib/requests";
import {
  canActOnStep,
  canCancel,
  canEscalate,
  canResubmit,
  canViewRequest
} from "@/lib/permissions";
import { formatDateRange, formatDateTime } from "@/lib/format";
import type { ApprovalStage } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const request = await getRequestById(params.id);
  if (!request) notFound();

  const context = accessContext(request);
  if (!canViewRequest(user, context)) redirect("/dashboard");

  const pendingStep = currentPendingStep(request);
  const canAct = pendingStep
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

  const destination =
    request.targetChurch?.name ??
    request.targetDistrict?.name ??
    request.targetConference?.name ??
    request.targetUnion?.name ??
    "Not applicable";
  const fromWhere =
    request.fromWhere ??
    (request.targetChurch
      ? `${request.targetChurch.name}, ${request.targetChurch.district.name}`
      : destination);
  const whereRequired =
    request.whereRequired ?? `${request.requestingChurch.name}, ${request.requestingChurch.district.name}`;
  const recordedMinuteNumber =
    request.approvalSteps.find((step) => step.stage === "DESTINATION" && step.minuteNumber)?.minuteNumber ??
    request.boardActionNumber;
  const actionPermissions = {
    canAct,
    canCancel: canCancel(user, context, request.status),
    canResubmit: canResubmit(user, context, request.status) || request.status === "DRAFT",
    canEscalate: canEscalate(user, context)
  };
  const terminal = ["APPROVED", "DECLINED", "CANCELLED"].includes(request.status);
  const nextEscalations = ["CONFERENCE", "UNION"].filter(
    (stage) => !request.approvalSteps.some((step) => step.stage === stage)
  );
  const hasTopActions =
    actionPermissions.canAct ||
    actionPermissions.canCancel ||
    actionPermissions.canResubmit ||
    (actionPermissions.canEscalate && !terminal && nextEscalations.length > 0);

  return (
    <AppShell user={user}>
      <div className="content">
        <header className="page-header">
          <div>
            <Link className="back-link" href="/requests">
              <ArrowLeft size={16} aria-hidden="true" />
              Back to requests
            </Link>
            <h1>{request.title}</h1>
            <p>{request.requestNumber}</p>
          </div>
          <div className="button-row">
            <StatusBadge status={request.status} />
            <PriorityBadge priority={request.priority} />
            <a className="button secondary" href={`/api/requests/${request.id}/pdf`}>
              <Download size={16} aria-hidden="true" />
              Download PDF
            </a>
          </div>
        </header>

        {hasTopActions ? (
          <section className="panel request-action-strip">
            <div className="panel-header">
              <div>
                <h2>Actions</h2>
                <p>Approve, decline, return, cancel, resubmit, or escalate where permitted.</p>
              </div>
            </div>
            <div className="panel-body">
              <RequestActions
                requestId={request.id}
                canAct={actionPermissions.canAct}
                canCancel={actionPermissions.canCancel}
                canResubmit={actionPermissions.canResubmit}
                canEscalate={actionPermissions.canEscalate}
                status={request.status}
                existingStages={request.approvalSteps.map((step) => step.stage)}
                currentStage={pendingStep?.stage}
                placement="top"
              />
            </div>
          </section>
        ) : null}

        <section className="split-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Request Information</h2>
                <p>Submitted by {request.requester.name}.</p>
              </div>
            </div>
            <div className="panel-body detail-grid">
              <div className="detail-item">
                <span>Type</span>
                <strong>{request.type.name}</strong>
              </div>
              <div className="detail-item">
                <span>Service Required</span>
                <strong>{request.serviceRequired ?? request.type.name}</strong>
              </div>
              <div className="detail-item">
                <span>Current Status</span>
                <StatusBadge status={request.status} />
              </div>
              <div className="detail-item">
                <span>Presentation Method</span>
                <strong>{request.presentationMethod ?? "Not set"}</strong>
              </div>
              <div className="detail-item">
                <span>Requesting Church</span>
                <strong>{request.requestingChurch.name}</strong>
                <p className="muted">
                  {request.requestingChurch.district.name}, {request.requestingChurch.district.conference.name}
                </p>
              </div>
              <div className="detail-item">
                <span>Target</span>
                <strong>{destination}</strong>
              </div>
              <div className="detail-item">
                <span>From Where</span>
                <strong>{fromWhere}</strong>
              </div>
              <div className="detail-item">
                <span>Where Required</span>
                <strong>{whereRequired}</strong>
              </div>
              <div className="detail-item">
                <span>Date Required</span>
                <strong>{formatDateRange(request.proposedDate, request.requiredToDate)}</strong>
              </div>
              <div className="detail-item">
                <span>Contact Person</span>
                <strong>{request.contactPerson}</strong>
              </div>
              <div className="detail-item">
                <span>Email</span>
                <strong>{request.contactEmail ?? request.requester.email}</strong>
              </div>
              <div className="detail-item">
                <span>Name Suggested</span>
                <strong>{request.nameSuggested ?? "Not set"}</strong>
              </div>
              <div className="detail-item">
                <span>Board Action Number</span>
                <strong>{recordedMinuteNumber ?? "Not set"}</strong>
              </div>
              <div className="detail-item">
                <span>Expenses Incurred By</span>
                <strong>{request.expensesIncurredBy ?? request.requestingChurch.name}</strong>
              </div>
              <div className="detail-item full">
                <span>Event Description</span>
                <p>{request.description}</p>
              </div>
              <div className="detail-item full">
                <span>PDF Signatories</span>
                <p>
                  Clerical Office: {request.clericalOfficeName ?? request.contactPerson}
                  {request.clericalOfficePhone ? ` (${request.clericalOfficePhone})` : ""}
                </p>
                <p>
                  First Elder: {request.firstElderName ?? "Not set"}
                  {request.firstElderPhone ? ` (${request.firstElderPhone})` : ""}
                </p>
                <p>
                  District Pastor: {request.districtPastorName ?? "Not set"}
                  {request.districtPastorPhone ? ` (${request.districtPastorPhone})` : ""}
                </p>
              </div>
              {request.additionalNotes ? (
                <div className="detail-item full">
                  <span>Additional Notes</span>
                  <p>{request.additionalNotes}</p>
                </div>
              ) : null}
              <div className="detail-item">
                <span>Created</span>
                <strong>{formatDateTime(request.createdAt)}</strong>
              </div>
              <div className="detail-item">
                <span>Updated</span>
                <strong>{formatDateTime(request.updatedAt)}</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Approval Timeline</h2>
                <p>Required stages and action history.</p>
              </div>
            </div>
            <div className="panel-body">
              <Timeline steps={request.approvalSteps} currentStepOrder={request.currentStepOrder} />
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Comments</h2>
              <p>Visible to users who can access this request.</p>
            </div>
          </div>
          <div className="panel-body">
            <CommentsThread requestId={request.id} comments={request.comments} />
          </div>
        </section>

        <section className="split-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Attachments</h2>
                <p>Validated supporting documents.</p>
              </div>
            </div>
            <div className="panel-body">
              {request.attachments.length === 0 ? (
                <div className="empty-state">No attachments uploaded.</div>
              ) : (
                <div className="bar-list">
                  {request.attachments.map((attachment) => (
                    <a className="chat-bubble" href={attachment.url} key={attachment.id}>
                      <div className="chat-meta">
                        <Paperclip size={15} aria-hidden="true" />
                        <strong>{attachment.filename}</strong>
                        <span>{Math.round(attachment.size / 1024)} KB</span>
                      </div>
                      <span className="button-row">
                        <Download size={15} aria-hidden="true" />
                        Open attachment
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <h2>Audit Trail</h2>
                <p>Timestamped system actions.</p>
              </div>
            </div>
            <div className="panel-body">
              {request.auditLogs.length === 0 ? (
                <div className="empty-state">No audit entries.</div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>User</th>
                        <th>When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {request.auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.action}</td>
                          <td>{log.actor?.name ?? "System"}</td>
                          <td>{formatDateTime(log.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
