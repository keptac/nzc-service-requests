import { formatDistanceToNowStrict, format } from "date-fns";
import { STATUS_LABELS, type RequestStatus } from "./constants";

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  return format(new Date(value), "dd MMM yyyy");
}

export function formatDateRange(from: Date | string | null | undefined, to: Date | string | null | undefined) {
  if (!from && !to) return "Not set";
  if (!to || (from && new Date(from).getTime() === new Date(to).getTime())) return formatDate(from ?? to);
  if (!from) return formatDate(to);
  return `${formatDate(from)} - ${formatDate(to)}`;
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "Not set";
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export function fromNow(value: Date | string | null | undefined) {
  if (!value) return "";
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function statusLabel(status: string) {
  return STATUS_LABELS[status as RequestStatus] ?? status;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function requestNumber(seed: number) {
  return `SDA-${new Date().getFullYear()}-${String(seed).padStart(5, "0")}`;
}
