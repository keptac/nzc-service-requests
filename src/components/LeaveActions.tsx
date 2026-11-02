"use client";

import { CheckCircle2, CornerDownLeft, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LeaveActionsProps = {
  applicationId: string;
  canApprove: boolean;
  canCancel: boolean;
  // "SUPERVISOR" → recommendation step; "ADCOM" → final approval requiring a minute number.
  stage: "SUPERVISOR" | "ADCOM" | null;
};

export function LeaveActions({ applicationId, canApprove, canCancel, stage }: LeaveActionsProps) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [minuteNumber, setMinuteNumber] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  if (!canApprove && !canCancel) return null;

  const isAdcom = stage === "ADCOM";
  const approveLabel = isAdcom ? "Approve" : "Recommend";

  async function submit(action: string, options?: { requireComment?: boolean }) {
    if (options?.requireComment && !comment.trim()) {
      setError("A comment is required for this action.");
      return;
    }
    if (action === "APPROVE" && isAdcom && !minuteNumber.trim()) {
      setError("An ADCOM minute number is required for final approval.");
      return;
    }
    const confirmText: Record<string, string> = {
      APPROVE: isAdcom ? "Approve this leave with the ADCOM minute number?" : "Recommend this leave application?",
      DECLINE: "Decline this leave application?",
      RETURN: "Return this application for clarification?",
      CANCEL: "Cancel this leave application?"
    };
    if (!window.confirm(confirmText[action] ?? "Continue?")) return;

    setPending(action);
    setError("");
    const response = await fetch(`/api/hr/leave-applications/${applicationId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment, minuteNumber })
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

  return (
    <div className="action-box">
      <label className="label" htmlFor="leave-action-comment">
        Decision comment
      </label>
      <textarea
        className="input"
        id="leave-action-comment"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Optional for approval; required for decline or return."
        maxLength={2000}
      />
      {canApprove && isAdcom ? (
        <>
          <label className="label" htmlFor="leave-adcom-minute">
            ADCOM minute number
          </label>
          <input
            className="input"
            id="leave-adcom-minute"
            value={minuteNumber}
            onChange={(event) => setMinuteNumber(event.target.value)}
            placeholder="Required for final approval"
            maxLength={80}
            type="text"
          />
        </>
      ) : null}
      {canApprove && !isAdcom ? (
        <p className="muted">As supervisor, recommending this application forwards it to ADCOM for the minute number.</p>
      ) : null}
      {error ? <div className="error-message">{error}</div> : null}
      <div className="button-row">
        {canApprove ? (
          <>
            <button className="button" disabled={pending !== null} onClick={() => submit("APPROVE")} type="button">
              <CheckCircle2 size={16} aria-hidden="true" />
              {approveLabel}
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
        {canCancel ? (
          <button className="button ghost" disabled={pending !== null} onClick={() => submit("CANCEL")} type="button">
            Cancel application
          </button>
        ) : null}
      </div>
    </div>
  );
}
