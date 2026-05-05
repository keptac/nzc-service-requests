import { Check, Clock3, CornerDownLeft, Minus, X } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { stageDisplayName } from "@/lib/workflow";

type Step = {
  id: string;
  stage: string;
  stepOrder: number;
  status: string;
  assignedRoleGroup: string;
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
        return (
          <div className="timeline-step" key={step.id}>
            <div className={`timeline-dot ${step.status.toLowerCase()} ${pending ? "pending" : ""}`}>
              <Icon size={16} aria-hidden="true" />
            </div>
            <div className="timeline-card">
              <strong>
                {step.stepOrder}. {stageDisplayName(step.stage)}
              </strong>
              <p>{step.assignedRoleGroup}</p>
              <p>
                {step.actedBy?.name
                  ? `${step.status.toLowerCase()} by ${step.actedBy.name} on ${formatDateTime(step.actedAt)}`
                  : pending
                    ? "Awaiting action"
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
