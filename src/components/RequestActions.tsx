"use client";

import { CheckCircle2, CornerDownLeft, Send, ShieldAlert, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type RequestActionsProps = {
  requestId: string;
  canAct: boolean;
  canCancel: boolean;
  canResubmit: boolean;
  canEscalate: boolean;
  status: string;
  existingStages: string[];
  currentStage?: string | null;
  placement?: "panel" | "top";
};

export function RequestActions({
  requestId,
  canAct,
  canCancel,
  canResubmit,
  canEscalate,
  status,
  existingStages,
  currentStage,
  placement = "panel"
}: RequestActionsProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [minuteNumber, setMinuteNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const nextEscalations = useMemo(() => {
    return ["CONFERENCE", "UNION"].filter((stage) => !existingStages.includes(stage));
  }, [existingStages]);
  const requiresMinuteNumber = currentStage === "DESTINATION";

  async function submit(action: string, options?: { requireComment?: boolean; escalateTo?: string }) {
    if (options?.requireComment && !comment.trim()) {
      setError("A comment is required for this action.");
      return;
    }
    if (action === "APPROVE" && requiresMinuteNumber && !minuteNumber.trim()) {
      setError("A minute number is required when the destination church accepts this request.");
      return;
    }

    const confirmText: Record<string, string> = {
      APPROVE: requiresMinuteNumber ? "Accept this request with the recorded minute number?" : "Approve this request?",
      DECLINE: "Decline this request?",
      RETURN: "Return this request for clarification?",
      CANCEL: "Cancel this request?",
      RESUBMIT: "Resubmit this request?",
      ESCALATE: "Escalate this request?"
    };

    if (!window.confirm(confirmText[action] ?? "Continue?")) return;

    setPending(action);
    setError("");
    const response = await fetch(`/api/requests/${requestId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        comment,
        minuteNumber: requiresMinuteNumber ? minuteNumber : undefined,
        escalateTo: options?.escalateTo
      })
    });
    setPending(null);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Action failed.");
      return;
    }

    setComment("");
    setMinuteNumber("");
    router.refresh();
  }

  const terminal = ["APPROVED", "DECLINED", "CANCELLED"].includes(status);
  const canEscalateNext = canEscalate && !terminal && nextEscalations.length > 0;
  const hasActions = canAct || canResubmit || canEscalateNext || canCancel;

  if (!hasActions) return null;

  return (
    <div className={`action-box ${placement === "top" ? "top-action-box" : ""}`}>
      <label className="label" htmlFor="action-comment">
        Action comment
      </label>
      <textarea
        className="input"
        id="action-comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Optional for approval; required for decline or return."
        maxLength={3000}
      />
      {canAct && requiresMinuteNumber ? (
        <>
          <label className="label" htmlFor="minute-number">
            Destination church minute number
          </label>
          <input
            className="input"
            id="minute-number"
            maxLength={80}
            onChange={(event) => setMinuteNumber(event.target.value)}
            placeholder="Required before accepting"
            type="text"
            value={minuteNumber}
          />
        </>
      ) : null}
      {error ? <div className="error-message">{error}</div> : null}
      <div className="button-row">
        {canAct ? (
          <>
            <button
              className="button"
              disabled={pending !== null}
              onClick={() => submit("APPROVE")}
              type="button"
            >
              <CheckCircle2 size={16} aria-hidden="true" />
              {requiresMinuteNumber ? "Accept" : "Approve"}
            </button>
            <button
              className="button warning"
              disabled={pending !== null}
              onClick={() => submit("RETURN", { requireComment: true })}
              type="button"
            >
              <CornerDownLeft size={16} aria-hidden="true" />
              Return
            </button>
            <button
              className="button danger"
              disabled={pending !== null}
              onClick={() => submit("DECLINE", { requireComment: true })}
              type="button"
            >
              <XCircle size={16} aria-hidden="true" />
              Decline
            </button>
          </>
        ) : null}
        {canResubmit ? (
          <button
            className="button info"
            disabled={pending !== null}
            onClick={() => submit("RESUBMIT")}
            type="button"
          >
            <Send size={16} aria-hidden="true" />
            Resubmit
          </button>
        ) : null}
        {canEscalateNext
          ? nextEscalations.map((stage) => (
              <button
                className="button secondary"
                disabled={pending !== null}
                key={stage}
                onClick={() => submit("ESCALATE", { escalateTo: stage })}
                type="button"
              >
                <ShieldAlert size={16} aria-hidden="true" />
                Escalate to {stage.toLowerCase()}
              </button>
            ))
          : null}
        {canCancel ? (
          <button
            className="button ghost"
            disabled={pending !== null}
            onClick={() => submit("CANCEL")}
            type="button"
          >
            Cancel request
          </button>
        ) : null}
      </div>
    </div>
  );
}
