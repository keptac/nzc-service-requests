"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "./DataTable";
import { LeaveStatusBadge } from "./Badges";
import { formatDate } from "@/lib/format";

export type LeaveApplicationRow = {
  id: string;
  applicationNumber: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string | Date;
  endDate: string | Date;
  totalDays: number;
  status: string;
};

export function LeaveApplicationsTable({ applications }: { applications: LeaveApplicationRow[] }) {
  const columns: DataTableColumn<LeaveApplicationRow>[] = [
    {
      key: "applicationNumber",
      header: "Application",
      sortValue: (row) => row.applicationNumber,
      cell: (row) => (
        <Link className="row-link" href={`/hr/leave/${row.id}`}>
          {row.applicationNumber}
        </Link>
      )
    },
    { key: "employee", header: "Employee", cell: (row) => row.employeeName, sortValue: (row) => row.employeeName },
    { key: "type", header: "Type", cell: (row) => row.leaveTypeName, sortValue: (row) => row.leaveTypeName },
    {
      key: "dates",
      header: "Dates",
      sortValue: (row) => new Date(row.startDate),
      cell: (row) => `${formatDate(row.startDate)} - ${formatDate(row.endDate)}`
    },
    { key: "days", header: "Days", cell: (row) => row.totalDays, sortValue: (row) => row.totalDays },
    {
      key: "status",
      header: "Status",
      sortValue: (row) => row.status,
      cell: (row) => <LeaveStatusBadge status={row.status} />
    }
  ];

  return (
    <DataTable
      columns={columns}
      emptyMessage="No leave applications found."
      getSearchText={(row) => `${row.applicationNumber} ${row.employeeName} ${row.leaveTypeName} ${row.status}`}
      initialSortKey="applicationNumber"
      initialSortDirection="desc"
      itemName="applications"
      rows={applications}
    />
  );
}
