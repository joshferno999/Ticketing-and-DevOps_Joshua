/**
 * BuildTrack — Requests List Page
 * PM/Dev-facing view at /requests
 * All state is local — no API calls.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  type RequestStatus,
  type RequestType,
  type Priority,
  STATUS_LABELS,
  STATUS_CLASSES,
  TYPE_LABELS,
  PRIORITY_CLASSES,
  avatarClasses,
} from "../../lib/buildtrack-constants";

interface Ticket {
  shortId: string;
  title: string;
  status: RequestStatus;
  type: RequestType;
  priority: Priority;
  product: string;
  module: string;
  assignee: string | null;
  createdAt: Date;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const now = Date.now();
const daysAgo = (d: number) => new Date(now - 1000 * 60 * 60 * 24 * d);

const TICKETS: Ticket[] = [
  {
    shortId: "REQ-001",
    title: "Dashboard export broken on Safari",
    status: "shipped",
    type: "bug",
    priority: "P1",
    product: "DCC",
    module: "Dashboard",
    assignee: "Hari",
    createdAt: daysAgo(12),
  },
  {
    shortId: "REQ-002",
    title: "Add filter by assignee to Pipeline view",
    status: "in_sprint",
    type: "enhancement",
    priority: "P2",
    product: "DCC",
    module: "Pipeline",
    assignee: "Marcus Dev",
    createdAt: daysAgo(5),
  },
  {
    shortId: "REQ-003",
    title: "Monthly deal volume report",
    status: "submitted",
    type: "data_reporting",
    priority: "P3",
    product: "SCT",
    module: "Dashboard",
    assignee: null,
    createdAt: daysAgo(1),
  },
  {
    shortId: "REQ-004",
    title: "Sequence email open rate not tracking",
    status: "blocked",
    type: "bug",
    priority: "P0",
    product: "SCT",
    module: "Sequence Management",
    assignee: "Marcus Dev",
    createdAt: daysAgo(3),
  },
  {
    shortId: "REQ-005",
    title: "New onboarding flow for reps",
    status: "pending",
    type: "new_feature",
    priority: "P2",
    product: "Hiring Tool",
    module: "Ops Tool",
    assignee: null,
    createdAt: daysAgo(7),
  },
  {
    shortId: "REQ-006",
    title: "Export deals to Excel",
    status: "in_sprint",
    type: "data_reporting",
    priority: "P2",
    product: "DCC",
    module: "Deal Details",
    assignee: "Hari",
    createdAt: daysAgo(4),
  },
  {
    shortId: "REQ-007",
    title: "Reply dashboard date range filter",
    status: "submitted",
    type: "enhancement",
    priority: "P3",
    product: "SCT",
    module: "Reply Dashboard",
    assignee: null,
    createdAt: daysAgo(2),
  },
  {
    shortId: "REQ-008",
    title: "Integrate Slack notifications for deal stage change",
    status: "pending",
    type: "process_change",
    priority: "P1",
    product: "DCC",
    module: "Pipeline",
    assignee: "Rishabh PM",
    createdAt: daysAgo(6),
  },
];

// ─── Label maps ───────────────────────────────────────────────────────────────

// ─── (STATUS_LABELS, STATUS_CLASSES, TYPE_LABELS, PRIORITY_CLASSES, avatarClasses imported from lib/buildtrack-constants) ──

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? "").charAt(0).toUpperCase();
  return ((parts[0] ?? "").charAt(0) + (parts[parts.length - 1] ?? "").charAt(0)).toUpperCase();
}

function relativeTime(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASSES[priority]}`}
    >
      {priority}
    </span>
  );
}

function TypeBadge({ type }: { type: RequestType }) {
  return (
    <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-xs text-on-surface-variant">
      {TYPE_LABELS[type]}
    </span>
  );
}

function AssigneeCell({ assignee }: { assignee: string | null }) {
  if (!assignee) {
    return <span className="text-xs text-on-surface-variant opacity-50">Unassigned</span>;
  }
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarClasses(assignee)}`}
      >
        {initials(assignee)}
      </span>
      <span className="truncate text-xs text-on-surface-variant">{assignee}</span>
    </div>
  );
}

// ─── Row actions dropdown ─────────────────────────────────────────────────────

interface RowActionsProps {
  ticket: Ticket;
  onCopyId: (id: string) => void;
}

function RowActions({ ticket, onCopyId }: RowActionsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant opacity-60 transition-opacity hover:opacity-100 hover:bg-surface-container-low"
        aria-label="Row actions"
      >
        <span className="material-symbols-outlined text-[18px]">more_horiz</span>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg">
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              navigate(`/requests/${ticket.shortId}`);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            View
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              navigate(`/requests/${ticket.shortId}`);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
            Edit
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onCopyId(ticket.shortId);
            }}
          >
            <span className="material-symbols-outlined text-[16px]">content_copy</span>
            Copy ID
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Filter / search bar ──────────────────────────────────────────────────────

type StatusFilter =
  | "all"
  | "submitted"
  | "in_review"
  | "in_sprint"
  | "blocked"
  | "shipped"
  | "wont_fix";

type TypeFilter = "all" | RequestType;
type PriorityFilter = "all" | Priority;

interface Filters {
  search: string;
  status: StatusFilter;
  type: TypeFilter;
  priority: PriorityFilter;
}

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "all",
  type: "all",
  priority: "all",
};

function isFiltersActive(f: Filters): boolean {
  return f.search !== "" || f.status !== "all" || f.type !== "all" || f.priority !== "all";
}

// Map filter dropdown value → actual statuses
function statusMatches(ticket: Ticket, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "in_review") return ticket.status === "in_review" || ticket.status === "pending";
  if (filter === "in_sprint") return ticket.status === "in_sprint" || ticket.status === "in_progress";
  if (filter === "wont_fix") return ticket.status === "wont_fix" || ticket.status === "next_phase";
  return ticket.status === filter;
}

function applyFilters(tickets: Ticket[], f: Filters): Ticket[] {
  return tickets.filter((t) => {
    if (f.search) {
      const q = f.search.toLowerCase();
      if (!t.title.toLowerCase().includes(q) && !t.shortId.toLowerCase().includes(q)) return false;
    }
    if (!statusMatches(t, f.status)) return false;
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.priority !== "all" && t.priority !== f.priority) return false;
    return true;
  });
}

interface SelectProps {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}

function FilterSelect({ value, onChange, children, className = "" }: SelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-8 rounded-lg border border-outline-variant bg-surface-container-lowest px-2.5 text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
    >
      {children}
    </select>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RequestsPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const navigate = useNavigate();

  const filtered = applyFilters(TICKETS, filters);
  const active = isFiltersActive(filters);

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id).catch(() => {});
    setCopyToast(id);
    setTimeout(() => setCopyToast(null), 2000);
  }, []);

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Amber API banner ── */}
      <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
        <span className="material-symbols-outlined text-[15px]">warning</span>
        Not connected to API — showing seed data only.
      </div>

      {/* ── Top bar ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-outline-variant bg-surface-container-lowest px-6 py-4">
        <h1 className="text-xl font-semibold text-on-surface">Requests</h1>
        <span className="rounded-full border border-outline-variant bg-surface-container px-2 py-0.5 text-xs font-medium text-on-surface-variant">
          {TICKETS.length}
        </span>
        <div className="ml-auto">
          <Link
            to="/requests/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm transition-opacity hover:opacity-90"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Request
          </Link>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="shrink-0 border-b border-outline-variant bg-background-alt px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex items-center">
            <span className="material-symbols-outlined pointer-events-none absolute left-2 text-[16px] text-on-surface-variant opacity-60">
              search
            </span>
            <input
              type="text"
              placeholder="Search by title or ID…"
              value={filters.search}
              onChange={(e) => setFilter("search", e.target.value)}
              className="h-8 w-56 rounded-lg border border-outline-variant bg-surface-container-lowest pl-7 pr-3 text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

          {/* Status */}
          <FilterSelect value={filters.status} onChange={(v) => setFilter("status", v as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="in_review">In Review</option>
            <option value="in_sprint">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="shipped">Shipped</option>
            <option value="wont_fix">Won't Fix</option>
          </FilterSelect>

          {/* Type */}
          <FilterSelect value={filters.type} onChange={(v) => setFilter("type", v as TypeFilter)}>
            <option value="all">All types</option>
            <option value="bug">Bug</option>
            <option value="enhancement">Enhancement</option>
            <option value="new_feature">New Feature</option>
            <option value="data_reporting">Data Reporting</option>
            <option value="process_change">Process Change</option>
            <option value="sponsor_build">Sponsor Build</option>
          </FilterSelect>

          {/* Priority */}
          <FilterSelect value={filters.priority} onChange={(v) => setFilter("priority", v as PriorityFilter)}>
            <option value="all">All priorities</option>
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </FilterSelect>

          {/* Clear filters */}
          {active && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-outline-variant px-2.5 py-1 text-xs text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Clear filters
            </button>
          )}

          {/* Row count */}
          <span className="ml-auto text-xs text-on-surface-variant">
            Showing{" "}
            <span className="font-medium text-on-surface">{filtered.length}</span> of{" "}
            <span className="font-medium text-on-surface">{TICKETS.length}</span>
          </span>
        </div>
      </div>

      {/* ── Table area ── */}
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          /* Empty state */
          <div className="flex h-full flex-col items-center justify-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] opacity-30">
              filter_list_off
            </span>
            <p className="text-sm opacity-60">No requests match your filters.</p>
            <button
              onClick={clearFilters}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-surface-container-lowest">
              <tr className="border-b border-outline-variant">
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Title
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Status
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Type
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Module
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Assignee
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold text-on-surface-variant">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr
                  key={ticket.shortId}
                  onClick={() => navigate(`/requests/${ticket.shortId}`)}
                  className="cursor-pointer border-b border-outline-variant/50 hover:bg-surface-container-low transition-colors"
                >
                  {/* ID */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="font-mono text-xs text-on-surface-variant opacity-70">
                      {ticket.shortId}
                    </span>
                  </td>

                  {/* Title */}
                  <td className="max-w-xs px-4 py-3">
                    <span className="block truncate font-medium text-on-surface">
                      {ticket.title}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusPill status={ticket.status} />
                  </td>

                  {/* Type */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <TypeBadge type={ticket.type} />
                  </td>

                  {/* Priority */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <PriorityBadge priority={ticket.priority} />
                  </td>

                  {/* Module */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-xs text-on-surface-variant">
                      {ticket.product}{" "}
                      <span className="opacity-40">›</span>{" "}
                      {ticket.module}
                    </span>
                  </td>

                  {/* Assignee */}
                  <td className="px-4 py-3">
                    <AssigneeCell assignee={ticket.assignee} />
                  </td>

                  {/* Created */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-xs text-on-surface-variant">
                      {relativeTime(ticket.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td
                    className="px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RowActions ticket={ticket} onCopyId={handleCopyId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Copy toast ── */}
      {copyToast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface shadow-lg">
          Copied <span className="font-mono font-medium">{copyToast}</span> to clipboard
        </div>
      )}
    </div>
  );
}
