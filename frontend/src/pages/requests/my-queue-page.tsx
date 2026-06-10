/**
 * BuildTrack — Dev Queue (My Queue)
 * Personal kanban for the logged-in developer.
 * All state is local — no API calls.
 */
import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type DevStage = "picked_up" | "in_progress" | "blocked" | "done";
type Priority = "P0" | "P1" | "P2" | "P3";

interface QueueTicket {
  shortId: string;
  title: string;
  priority: Priority;
  product: string;
  module: string;
  stage: DevStage;
  blockReason?: string;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED: QueueTicket[] = [
  {
    shortId: "REQ-001",
    title: "Dashboard export broken on Safari",
    priority: "P1",
    product: "DCC",
    module: "Dashboard",
    stage: "done",
  },
  {
    shortId: "REQ-002",
    title: "Add filter by assignee to Pipeline",
    priority: "P2",
    product: "DCC",
    module: "Pipeline",
    stage: "in_progress",
  },
  {
    shortId: "REQ-004",
    title: "Sequence email open rate not tracking",
    priority: "P0",
    product: "SCT",
    module: "Sequence Mgmt",
    stage: "blocked",
    blockReason: "Waiting for SCT API access",
  },
  {
    shortId: "REQ-006",
    title: "Export deals to Excel",
    priority: "P2",
    product: "DCC",
    module: "Deal Details",
    stage: "in_progress",
  },
  {
    shortId: "REQ-010",
    title: "Fix pagination bug on contacts table",
    priority: "P1",
    product: "DCC",
    module: "Contacts",
    stage: "picked_up",
  },
  {
    shortId: "REQ-011",
    title: "Add bulk tagging to deals",
    priority: "P3",
    product: "DCC",
    module: "Pipeline",
    stage: "picked_up",
  },
];

// ─── Stage config ─────────────────────────────────────────────────────────────

interface StageConfig {
  label: string;
  icon: string;
  ringColor: string;
  iconColor: string;
  headerBg: string;
  countBg: string;
}

const STAGE_CONFIG: Record<DevStage, StageConfig> = {
  picked_up: {
    label: "Picked Up",
    icon: "pan_tool",
    ringColor: "border-blue-200",
    iconColor: "text-blue-500",
    headerBg: "bg-blue-50",
    countBg: "bg-blue-100 text-blue-700",
  },
  in_progress: {
    label: "In Progress",
    icon: "pending",
    ringColor: "border-violet-200",
    iconColor: "text-violet-500",
    headerBg: "bg-violet-50",
    countBg: "bg-violet-100 text-violet-700",
  },
  blocked: {
    label: "Blocked",
    icon: "block",
    ringColor: "border-red-200",
    iconColor: "text-red-500",
    headerBg: "bg-red-50",
    countBg: "bg-red-100 text-red-700",
  },
  done: {
    label: "Done",
    icon: "check_circle",
    ringColor: "border-green-200",
    iconColor: "text-green-500",
    headerBg: "bg-green-50",
    countBg: "bg-green-100 text-green-700",
  },
};

const STAGE_ORDER: DevStage[] = ["picked_up", "in_progress", "blocked", "done"];

// ─── Priority badge ───────────────────────────────────────────────────────────

const PRIORITY_CLASSES: Record<Priority, string> = {
  P0: "bg-red-100 text-red-700 border border-red-300",
  P1: "bg-orange-100 text-orange-700 border border-orange-300",
  P2: "bg-amber-100 text-amber-700 border border-amber-300",
  P3: "bg-green-100 text-green-700 border border-green-300",
};

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASSES[priority]}`}>
      {priority}
    </span>
  );
}

// ─── Next-stage popover for "In Progress" ────────────────────────────────────

interface NextStagePopoverProps {
  onSelect: (stage: DevStage) => void;
  onClose: () => void;
}

function NextStagePopover({ onSelect, onClose }: NextStagePopoverProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-30 mb-2 w-48 rounded-xl border border-outline-variant bg-surface-container-lowest py-1 shadow-lg"
    >
      <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant opacity-60">
        Move to
      </p>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
        onClick={() => onSelect("blocked")}
      >
        <span className="material-symbols-outlined text-[16px] text-red-500">block</span>
        Mark as Blocked
      </button>
      <button
        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
        onClick={() => onSelect("done")}
      >
        <span className="material-symbols-outlined text-[16px] text-green-500">check_circle</span>
        Mark as Done
      </button>
    </div>
  );
}

// ─── Ticket card ─────────────────────────────────────────────────────────────

interface TicketCardProps {
  ticket: QueueTicket;
  onMove: (id: string, stage: DevStage) => void;
}

function TicketCard({ ticket, onMove }: TicketCardProps) {
  const [showPopover, setShowPopover] = useState(false);
  const isDone = ticket.stage === "done";
  const isBlocked = ticket.stage === "blocked";
  const isInProgress = ticket.stage === "in_progress";

  function handleMoveClick() {
    if (isInProgress) {
      setShowPopover((v) => !v);
      return;
    }
    if (isDone) return;
    // picked_up → in_progress, blocked → done
    const idx = STAGE_ORDER.indexOf(ticket.stage);
    if (ticket.stage === "blocked") {
      onMove(ticket.shortId, "done");
    } else {
      const next = STAGE_ORDER[idx + 1];
      if (next) onMove(ticket.shortId, next);
    }
  }

  function getNextLabel(): string {
    if (ticket.stage === "picked_up") return "Move to In Progress →";
    if (ticket.stage === "in_progress") return "Move to next →";
    if (ticket.stage === "blocked") return "Mark as Done →";
    return "";
  }

  return (
    <div
      className={`relative flex flex-col gap-2.5 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm transition-opacity ${isDone ? "opacity-60" : ""}`}
    >
      {/* Done overlay checkmark */}
      {isDone && (
        <div className="absolute right-3 top-3">
          <span className="material-symbols-outlined text-[20px] text-green-500">check_circle</span>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-start gap-2">
        <Link
          to={`/requests/${ticket.shortId}`}
          className="font-mono text-[11px] text-on-surface-variant opacity-60 hover:opacity-100 hover:underline transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          {ticket.shortId}
        </Link>
        <PriorityBadge priority={ticket.priority} />
      </div>

      {/* Title */}
      <p className="line-clamp-2 text-sm font-medium leading-snug text-on-surface">
        {ticket.title}
      </p>

      {/* Module breadcrumb */}
      <p className="text-[11px] text-on-surface-variant opacity-60">
        {ticket.product} <span className="opacity-50">›</span> {ticket.module}
      </p>

      {/* Block reason chip */}
      {isBlocked && ticket.blockReason && (
        <div className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5">
          <span className="material-symbols-outlined text-[13px] text-red-500">error</span>
          <span className="text-[11px] text-red-700">{ticket.blockReason}</span>
        </div>
      )}

      {/* Move button */}
      {!isDone && (
        <div className="relative mt-auto">
          <button
            onClick={handleMoveClick}
            className="inline-flex w-full items-center justify-center gap-1 rounded-xl border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors"
          >
            {getNextLabel()}
          </button>
          {showPopover && (
            <NextStagePopover
              onSelect={(stage) => {
                setShowPopover(false);
                onMove(ticket.shortId, stage);
              }}
              onClose={() => setShowPopover(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Stage column ─────────────────────────────────────────────────────────────

interface StageColumnProps {
  stage: DevStage;
  tickets: QueueTicket[];
  onMove: (id: string, stage: DevStage) => void;
}

function StageColumn({ stage, tickets, onMove }: StageColumnProps) {
  const cfg = STAGE_CONFIG[stage];

  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-3">
      {/* Column header */}
      <div className={`flex items-center gap-2 rounded-2xl border ${cfg.ringColor} ${cfg.headerBg} px-4 py-2.5`}>
        <span className={`material-symbols-outlined text-[20px] ${cfg.iconColor}`}>{cfg.icon}</span>
        <span className="text-sm font-semibold text-on-surface">{cfg.label}</span>
        <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.countBg}`}>
          {tickets.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-outline-variant py-10 text-on-surface-variant opacity-40">
            <span className="material-symbols-outlined text-[28px]">inbox</span>
            <p className="text-xs">No tickets</p>
          </div>
        ) : (
          tickets.map((t) => (
            <TicketCard key={t.shortId} ticket={t} onMove={onMove} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyQueuePage() {
  const [tickets, setTickets] = useState<QueueTicket[]>(SEED);

  function handleMove(id: string, newStage: DevStage) {
    setTickets((prev) =>
      prev.map((t) => (t.shortId === id ? { ...t, stage: newStage } : t))
    );
  }

  const grouped = STAGE_ORDER.reduce<Record<DevStage, QueueTicket[]>>(
    (acc, stage) => {
      acc[stage] = tickets.filter((t) => t.stage === stage);
      return acc;
    },
    { picked_up: [], in_progress: [], blocked: [], done: [] }
  );

  const total = tickets.length;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Amber API banner */}
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
        <span className="material-symbols-outlined text-[15px]">warning</span>
        Not connected to API — showing seed data only.
      </div>

      {/* Page header */}
      <div className="shrink-0 border-b border-outline-variant bg-surface-container-lowest px-6 py-5">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-on-surface">My Queue</h1>
            <p className="mt-0.5 text-sm text-on-surface-variant">Tickets assigned to you</p>
          </div>
          <span className="ml-2 rounded-full border border-outline-variant bg-surface-container px-2.5 py-0.5 text-xs font-medium text-on-surface-variant">
            {total}
          </span>
        </div>
      </div>

      {/* Kanban board */}
      <div className="min-h-0 flex-1 overflow-auto bg-background-alt px-6 py-6">
        <div className="flex min-w-max gap-4">
          {STAGE_ORDER.map((stage) => (
            <StageColumn
              key={stage}
              stage={stage}
              tickets={grouped[stage]}
              onMove={handleMove}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
