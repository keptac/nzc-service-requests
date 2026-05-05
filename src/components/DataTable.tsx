"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

type SortValue = string | number | boolean | Date | null | undefined;

export type DataTableColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => SortValue;
};

type DataTableProps<T extends { id: string }> = {
  rows: T[];
  columns: DataTableColumn<T>[];
  emptyMessage?: string;
  getSearchText?: (row: T) => string;
  initialSortKey?: string;
  initialSortDirection?: "asc" | "desc";
  itemName?: string;
};

function normalizeSortValue(value: SortValue) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return value.toLowerCase();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? "";
}

function compareSortValues(left: SortValue, right: SortValue, direction: "asc" | "desc") {
  const a = normalizeSortValue(left);
  const b = normalizeSortValue(right);
  const result = a > b ? 1 : a < b ? -1 : 0;
  return direction === "asc" ? result : -result;
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  emptyMessage = "No records found.",
  getSearchText,
  initialSortKey,
  initialSortDirection = "asc",
  itemName = "records"
}: DataTableProps<T>) {
  const firstSortable = columns.find((column) => column.sortValue);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(initialSortKey ?? firstSortable?.key ?? "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(initialSortDirection);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const activeSort = columns.find((column) => column.key === sortKey);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      const columnText = columns
        .map((column) => column.sortValue?.(row))
        .filter((value) => value !== null && value !== undefined)
        .join(" ");
      const haystack = `${getSearchText?.(row) ?? ""} ${columnText}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [columns, getSearchText, query, rows]);

  const sortedRows = useMemo(() => {
    if (!activeSort?.sortValue) return filteredRows;
    return [...filteredRows].sort((left, right) =>
      compareSortValues(activeSort.sortValue?.(left), activeSort.sortValue?.(right), sortDirection)
    );
  }, [activeSort, filteredRows, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * pageSize;
  const pageRows = sortedRows.slice(start, start + pageSize);
  const visibleStart = sortedRows.length === 0 ? 0 : start + 1;
  const visibleEnd = Math.min(start + pageSize, sortedRows.length);

  function updateSort(column: DataTableColumn<T>) {
    if (!column.sortValue) return;
    setPage(1);
    if (sortKey === column.key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(column.key);
    setSortDirection("asc");
  }

  return (
    <div className="managed-table">
      <div className="table-tools">
        <div className="field table-search">
          <label htmlFor={`table-search-${itemName.replace(/\s+/g, "-")}`}>Filter</label>
          <input
            id={`table-search-${itemName.replace(/\s+/g, "-")}`}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder={`Search ${itemName}`}
            type="search"
            value={query}
          />
        </div>
        <div className="field table-page-size">
          <label htmlFor={`table-page-size-${itemName.replace(/\s+/g, "-")}`}>Rows</label>
          <select
            id={`table-page-size-${itemName.replace(/\s+/g, "-")}`}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            value={pageSize}
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
        <p className="table-count">
          {visibleStart}-{visibleEnd} of {sortedRows.length}
          {sortedRows.length !== rows.length ? ` filtered from ${rows.length}` : ""}
        </p>
      </div>

      {rows.length === 0 || sortedRows.length === 0 ? (
        <div className="empty-state">{rows.length === 0 ? emptyMessage : "No records match the current filter."}</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.key}>
                    {column.sortValue ? (
                      <button className="sort-button" onClick={() => updateSort(column)} type="button">
                        {column.header}
                        <ChevronsUpDown size={14} aria-hidden="true" />
                        {sortKey === column.key ? (
                          <span className="sort-direction">{sortDirection === "asc" ? "Asc" : "Desc"}</span>
                        ) : null}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.cell(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pagination-bar">
        <button
          className="button secondary"
          disabled={safePage <= 1}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
          type="button"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Previous
        </button>
        <span>
          Page {safePage} of {pageCount}
        </span>
        <button
          className="button secondary"
          disabled={safePage >= pageCount}
          onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
          type="button"
        >
          Next
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
