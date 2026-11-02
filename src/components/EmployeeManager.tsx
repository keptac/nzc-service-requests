"use client";

import { CalendarClock, Plus, Save, UserCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "./DataTable";
import { EMPLOYEE_STATUSES, EMPLOYMENT_TYPES } from "@/lib/constants";

type Option = { id: string; name: string };

export type EmployeeRow = {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  department: string | null;
  status: string;
  linkedUser: string | null;
  supervisorName: string | null;
};

type EmployeeManagerProps = {
  employees: EmployeeRow[];
  unions: Option[];
  conferences: Option[];
  districts: Option[];
  churches: Option[];
  users: Option[];
  supervisors: Option[];
  leaveTypes: Option[];
  currentYear: number;
};

export function EmployeeManager({
  employees,
  unions,
  conferences,
  districts,
  churches,
  users,
  supervisors,
  leaveTypes,
  currentYear
}: EmployeeManagerProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function api(path: string, method: "POST" | "PATCH", payload: Record<string, unknown>) {
    setPending(true);
    setError("");
    const response = await fetch(path, {
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
    const payload = Object.fromEntries(formData.entries());
    const ok = await api("/api/admin/employees", "POST", payload);
    if (ok) form.reset();
  }

  async function editStatus(row: EmployeeRow) {
    const status = window.prompt(
      `Status (${EMPLOYEE_STATUSES.join(", ")})`,
      row.status
    );
    if (!status) return;
    await api("/api/admin/employees", "PATCH", { id: row.id, status });
  }

  async function setBalance(row: EmployeeRow) {
    if (leaveTypes.length === 0) {
      setError("Create a leave type first.");
      return;
    }
    const typeList = leaveTypes.map((type, index) => `${index + 1}. ${type.name}`).join("\n");
    const choice = window.prompt(`Leave type for ${row.firstName} ${row.lastName}:\n${typeList}`, "1");
    if (!choice) return;
    const leaveType = leaveTypes[Number(choice) - 1];
    if (!leaveType) {
      setError("Invalid leave type selection.");
      return;
    }
    const entitled = window.prompt(`Entitled days for ${currentYear}`, "0");
    if (entitled === null) return;
    await api("/api/hr/leave-balances", "POST", {
      employeeId: row.id,
      leaveTypeId: leaveType.id,
      year: currentYear,
      entitledDays: Number(entitled)
    });
  }

  async function editSupervisor(row: EmployeeRow) {
    const options = supervisors.filter((supervisor) => supervisor.id !== row.id);
    const list = options.map((supervisor, index) => `${index + 1}. ${supervisor.name}`).join("\n");
    const choice = window.prompt(
      `Reports to — enter a number, or 0 for none:\n0. None\n${list}`,
      "0"
    );
    if (choice === null) return;
    const index = Number(choice);
    const supervisorId = index === 0 ? "" : options[index - 1]?.id;
    if (supervisorId === undefined) {
      setError("Invalid supervisor selection.");
      return;
    }
    await api("/api/admin/employees", "PATCH", { id: row.id, supervisorId });
  }

  const columns: DataTableColumn<EmployeeRow>[] = [
    {
      key: "employee",
      header: "Employee",
      sortValue: (row) => `${row.lastName} ${row.firstName}`,
      cell: (row) => (
        <div className="row-title">
          <strong>
            {row.firstName} {row.lastName}
          </strong>
          <span className="muted">{row.employeeNumber}</span>
        </div>
      )
    },
    { key: "jobTitle", header: "Job title", cell: (row) => row.jobTitle ?? "N/A", sortValue: (row) => row.jobTitle ?? "" },
    {
      key: "department",
      header: "Department",
      cell: (row) => row.department ?? "N/A",
      sortValue: (row) => row.department ?? ""
    },
    {
      key: "supervisor",
      header: "Reports to",
      cell: (row) => row.supervisorName ?? "None",
      sortValue: (row) => row.supervisorName ?? ""
    },
    {
      key: "linkedUser",
      header: "Login",
      cell: (row) => row.linkedUser ?? "None",
      sortValue: (row) => row.linkedUser ?? ""
    },
    { key: "status", header: "Status", cell: (row) => row.status, sortValue: (row) => row.status },
    {
      key: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="button-row">
          <button className="button secondary" onClick={() => editStatus(row)} type="button">
            <Save size={15} aria-hidden="true" />
            Status
          </button>
          <button className="button secondary" onClick={() => editSupervisor(row)} type="button">
            <UserCog size={15} aria-hidden="true" />
            Supervisor
          </button>
          <button className="button ghost" onClick={() => setBalance(row)} type="button">
            <CalendarClock size={15} aria-hidden="true" />
            Set balance
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="entity-body">
      <form className="inline-form" onSubmit={create}>
        <div className="field">
          <label htmlFor="emp-number">Employee number</label>
          <input id="emp-number" name="employeeNumber" required />
        </div>
        <div className="field">
          <label htmlFor="emp-first">First name</label>
          <input id="emp-first" name="firstName" required />
        </div>
        <div className="field">
          <label htmlFor="emp-last">Last name</label>
          <input id="emp-last" name="lastName" required />
        </div>
        <div className="field">
          <label htmlFor="emp-email">Email</label>
          <input id="emp-email" name="email" type="email" />
        </div>
        <div className="field">
          <label htmlFor="emp-phone">Phone</label>
          <input id="emp-phone" name="phone" placeholder="+263..." />
        </div>
        <div className="field">
          <label htmlFor="emp-title">Job title</label>
          <input id="emp-title" name="jobTitle" />
        </div>
        <div className="field">
          <label htmlFor="emp-dept">Department</label>
          <input id="emp-dept" name="department" />
        </div>
        <div className="field">
          <label htmlFor="emp-type">Employment type</label>
          <select id="emp-type" name="employmentType" defaultValue="FULL_TIME">
            {EMPLOYMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-hire">Hire date</label>
          <input id="emp-hire" name="hireDate" type="date" />
        </div>
        <div className="field">
          <label htmlFor="emp-union">Union</label>
          <select id="emp-union" name="unionId" defaultValue="">
            <option value="">None</option>
            {unions.map((union) => (
              <option key={union.id} value={union.id}>
                {union.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-conference">Conference</label>
          <select id="emp-conference" name="conferenceId" defaultValue="">
            <option value="">None</option>
            {conferences.map((conference) => (
              <option key={conference.id} value={conference.id}>
                {conference.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-district">District</label>
          <select id="emp-district" name="districtId" defaultValue="">
            <option value="">None</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-church">Church</label>
          <select id="emp-church" name="churchId" defaultValue="">
            <option value="">None</option>
            {churches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-user">Linked login</label>
          <select id="emp-user" name="userId" defaultValue="">
            <option value="">None</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="emp-supervisor">Reports to (supervisor)</label>
          <select id="emp-supervisor" name="supervisorId" defaultValue="">
            <option value="">None</option>
            {supervisors.map((supervisor) => (
              <option key={supervisor.id} value={supervisor.id}>
                {supervisor.name}
              </option>
            ))}
          </select>
        </div>
        <button className="button" disabled={pending} type="submit">
          <Plus size={16} aria-hidden="true" />
          Add employee
        </button>
      </form>
      {error ? <div className="error-message">{error}</div> : null}
      <DataTable
        columns={columns}
        emptyMessage="No employees yet."
        getSearchText={(row) => `${row.firstName} ${row.lastName} ${row.employeeNumber} ${row.jobTitle ?? ""} ${row.department ?? ""}`}
        initialSortKey="employee"
        itemName="employees"
        rows={employees}
      />
    </div>
  );
}
