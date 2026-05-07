import { Check, Clock3, CornerDownLeft, Minus, X } from "lucide-react";
import { approvalAssignmentLabel, approvalStageName } from "@/lib/approval-display";
import { formatDateTime } from "@/lib/format";

type Step = {
  id: string;
  stage: string;
  stepOrder: number;
  status: string;
  assignedRoleGroup: string;
  assignedScopeType?: string;
  assignedChurch?: { name: string } | null;
  assignedDistrict?: { name: string } | null;
  assignedConference?: { name: string } | null;
  assignedUnion?: { name: string } | null;
  actedAt: Date | string | null;
  comment: string | null;
  minuteNumber?: string | null;
  actedBy?: { name: string } | null;
};

function iconFor(status: string) {
  if (status === "APPROVED") return Check;
  if (status === "DECLINED") return X;
  if (status === "RETURNED") return CornerDownLeft;
  if (status === "PENDING") return Clock3;
  return Minus;
}

export function Timeline({ steps, currentStepOrder }: { steps: Step[]; currentStepOrder: number | null }) {
  if (steps.length === 0) {
    return <div className="empty-state">No approval steps yet.</div>;
  }

  return (
    <div className="timeline">
      {steps.map((step) => {
        const Icon = iconFor(step.status);
        const pending = step.status === "PENDING" && step.stepOrder === currentStepOrder;
        const assignmentLabel = approvalAssignmentLabel(step);
        const statusLabel = pending
          ? "Current stage"
          : step.status === "APPROVED"
            ? "Completed"
            : step.status === "DECLINED"
              ? "Declined"
              : step.status === "RETURNED"
                ? "Returned"
                : step.status === "PENDING"
                  ? "Queued"
                  : step.status;
        return (
          <div className="timeline-step" key={step.id} aria-current={pending ? "step" : undefined}>
            <div className={`timeline-dot ${step.status.toLowerCase()} ${pending ? "pending" : ""}`}>
              <Icon size={16} aria-hidden="true" />
            </div>
            <div className={`timeline-card ${pending ? "current" : ""}`}>
              <div className="timeline-stage-heading">
                <strong>
                  {step.stepOrder}. {approvalStageName(step)}
                </strong>
                <span className={pending ? "timeline-current-label" : "timeline-status-label"}>{statusLabel}</span>
              </div>
              <p>{assignmentLabel}</p>
              <p>
                {step.actedBy?.name
                  ? `${step.status.toLowerCase()} by ${step.actedBy.name} on ${formatDateTime(step.actedAt)}`
                  : pending
                    ? `Awaiting action from ${assignmentLabel}`
                    : "Queued"}
              </p>
              {step.minuteNumber ? <p>Minute number: {step.minuteNumber}</p> : null}
              {step.comment ? <p>{step.comment}</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
