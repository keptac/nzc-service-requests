import { CheckCircle2, Clock3, FileText, HelpCircle, OctagonX, XCircle } from "lucide-react";
import { statusLabel } from "@/lib/format";

function statusClass(status: string) {
  if (status === "APPROVED") return "status-approved";
  if (status === "DECLINED") return "status-declined";
  if (status === "CANCELLED") return "status-cancelled";
  if (status === "RETURNED_FOR_CLARIFICATION") return "status-returned";
  if (status.startsWith("PENDING")) return "status-pending";
  return "status-draft";
}

export function StatusBadge({ status }: { status: string }) {
  const Icon =
    status === "APPROVED"
      ? CheckCircle2
      : status === "DECLINED"
        ? XCircle
        : status === "CANCELLED"
          ? OctagonX
          : status === "RETURNED_FOR_CLARIFICATION"
            ? HelpCircle
            : status.startsWith("PENDING")
              ? Clock3
              : FileText;

  return (
    <span className={`badge ${statusClass(status)}`}>
      <Icon size={14} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
