"use client";

import { Plus, Power, RotateCcw, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "./DataTable";

export type LeaveTypeRow = {
  id: string;
  name: string;
  code: string;
  defaultAnnualDays: number;
  paid: boolean;
  requiresApproval: boolean;
  active: boolean;
};

export function LeaveTypeManager({ leaveTypes }: { leaveTypes: LeaveTypeRow[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function api(method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    const response = await fetch("/api/admin/leaveTypes", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setPending(false);
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.error ?? "Action failed.");
      return false;
    }
    router.refresh();
    return true;
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const ok = await api("POST", {
      name: formData.get("name"),
      code: String(formData.get("code") ?? "").toUpperCase(),
      defaultAnnualDays: Number(formData.get("defaultAnnualDays") ?? 0),
      paid: formData.get("paid") === "on",
      requiresApproval: true,
      description: formData.get("description") || null
    });
    if (ok) form.reset();
  }

  async function editDays(row: LeaveTypeRow) {
    const value = window.prompt(`Annual entitlement (days) for ${row.name}`, String(row.defaultAnnualDays));
    if (value === null) return;
    await api("PATCH", { id: row.id, defaultAnnualDays: Number(value) });
  }

  async function toggle(row: LeaveTypeRow) {
    if (!window.confirm(row.active ? "Deactivate this leave type?" : "Reactivate this leave type?")) return;
    await api("PATCH", { id: row.id, active: !row.active });
  }

  const columns: DataTableColumn<LeaveTypeRow>[] = [
    { key: "name", header: "Name", cell: (row) => row.name, sortValue: (row) => row.name },
    { key: "code", header: "Code", cell: (row) => row.code, sortValue: (row) => row.code },
    {
      key: "days",
      header: "Annual days",
      cell: (row) => row.defaultAnnualDays,
      sortValue: (row) => row.defaultAnnualDays
    },
    { key: "paid", header: "Paid", cell: (row) => (row.paid ? "Yes" : "No"), sortValue: (row) => row.paid },
    {
      key: "status",
      header: "Status",
      cell: (row) => (row.active ? "Active" : "Inactive"),
      sortValue: (row) => (row.active ? "Active" : "Inactive")
    },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="button-row">
          <button className="button secondary" onClick={() => editDays(row)} type="button">
            <Save size={15} aria-hidden="true" />
            Edit days
          </button>
          <button className="button ghost" onClick={() => toggle(row)} type="button">
            {row.active ? <Power size={15} /> : <RotateCcw size={15} />}
            {row.active ? "Deactivate" : "Activate"}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="entity-body">
      <form className="inline-form" onSubmit={create}>
        <div className="field">
          <label htmlFor="lt-name">Name</label>
          <input id="lt-name" name="name" required minLength={2} />
        </div>
        <div className="field">
          <label htmlFor="lt-code">Code</label>
          <input id="lt-code" name="code" required placeholder="ANNUAL" />
        </div>
        <div className="field">
          <label htmlFor="lt-days">Annual days</label>
          <input id="lt-days" name="defaultAnnualDays" type="number" min={0} max={366} defaultValue={0} />
        </div>
        <label className="check-field">
          <input name="paid" type="checkbox" defaultChecked />
          Paid leave
        </label>
        <div className="field">
          <label htmlFor="lt-description">Description</label>
          <input id="lt-description" name="description" maxLength={300} />
        </div>
        <button className="button" disabled={pending} type="submit">
          <Plus size={16} aria-hidden="true" />
          Add leave type
        </button>
      </form>
      {error ? <div className="error-message">{error}</div> : null}
      <DataTable
        columns={columns}
        emptyMessage="No leave types configured."
        getSearchText={(row) => `${row.name} ${row.code}`}
        initialSortKey="name"
        itemName="leave types"
        rows={leaveTypes}
      />
    </div>
  );
}
