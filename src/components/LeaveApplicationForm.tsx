"use client";

import { CalendarDays, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type LeaveTypeOption = {
  id: string;
  name: string;
  paid: boolean;
};

type EmployeeOption = {
  id: string;
  label: string;
};

type BalanceHint = Record<string, number>; // leaveTypeId -> remaining days

type LeaveApplicationFormProps = {
  leaveTypes: LeaveTypeOption[];
  // When present, the form lets HR pick the employee; otherwise it files for the current user.
  employees?: EmployeeOption[];
  balances?: BalanceHint;
};

function countDays(start: string, end: string) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  const diff = b.getTime() - a.getTime();
  if (Number.isNaN(diff) || diff < 0) return 0;
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
}

export function LeaveApplicationForm({ leaveTypes, employees, balances }: LeaveApplicationFormProps) {
  const router = useRouter();
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState(employees?.[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [contactWhileAway, setContactWhileAway] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const totalDays = useMemo(() => countDays(startDate, endDate), [startDate, endDate]);
  const remaining = balances?.[leaveTypeId];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (totalDays <= 0) {
      setError("Select a valid start and end date.");
      return;
    }
    setPending(true);
    setError("");
    const response = await fetch("/api/hr/leave-applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leaveTypeId,
        employeeId: employees ? employeeId : undefined,
        startDate,
        endDate,
        reason,
        contactWhileAway: contactWhileAway || undefined
      })
    });
    setPending(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Could not submit the application.");
      return;
    }
    const data = await response.json();
    router.push(`/hr/leave/${data.id}`);
    router.refresh();
  }

  return (
    <form className="stacked-form" onSubmit={submit}>
      {employees ? (
        <div className="field">
          <label htmlFor="leave-employee">Employee</label>
          <select id="leave-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="leave-type">Leave type</label>
        <select id="leave-type" value={leaveTypeId} onChange={(event) => setLeaveTypeId(event.target.value)} required>
          {leaveTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
              {type.paid ? "" : " (unpaid)"}
            </option>
          ))}
        </select>
        {remaining !== undefined ? (
          <small className="muted">{remaining} day(s) remaining this year</small>
        ) : null}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="leave-start">Start date</label>
          <input id="leave-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="leave-end">End date</label>
          <input id="leave-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
        </div>
      </div>

      <div className="leave-days-hint">
        <CalendarDays size={16} aria-hidden="true" />
        {totalDays > 0 ? `${totalDays} day(s) requested` : "Select dates to see total days"}
      </div>

      <div className="field">
        <label htmlFor="leave-reason">Reason</label>
        <textarea
          id="leave-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={2000}
          minLength={3}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="leave-contact">Contact while away (optional)</label>
        <input
          id="leave-contact"
          value={contactWhileAway}
          onChange={(event) => setContactWhileAway(event.target.value)}
          maxLength={200}
          placeholder="Phone or email"
        />
      </div>

      {error ? <div className="error-message">{error}</div> : null}

      <div className="button-row">
        <button className="button" disabled={pending} type="submit">
          <Send size={16} aria-hidden="true" />
          Submit application
        </button>
      </div>
    </form>
  );
}
