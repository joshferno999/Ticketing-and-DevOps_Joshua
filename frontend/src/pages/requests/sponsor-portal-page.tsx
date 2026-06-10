/**
 * BuildTrack — Sponsor Portal
 * Sponsors see their own requests + progress timeline
 */
import { useState } from "react";
import { Link } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus =
  | "submitted"
  | "clarification_needed"
  | "pending"
  | "in_review"
  | "in_sprint"
  | "in_progress"
  | "blocked"
  | "shipped"
  | "wont_fix"
  | "next_phase";

type RequestType =
  | "bug"
  | "enhancement"
  | "new_feature"
  | "data_reporting"
  | "process_change"
  | "sponsor_build";

interface Comment {
  id: string;
  author: string;
  body: string;
  timestamp: string;
}

interface StatusHistoryEntry {
  step: "submitted" | "in_review" | "in_sprint" | "shipped";
  completedAt?: Date;
}

interface SponsorRequest {
  id: string;
  title: string;
  status: RequestStatus;
  requestType: RequestType;
  product: string;
  module: string;
  submodule?: string;
  urgency: "critical" | "high" | "medium" | "low";
  description: string;
  createdAt: Date;
  attachmentCount: number;
  comments: Comment[];
  statusHistory: StatusHistoryEntry[];
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_REQUESTS: SponsorRequest[] = [
  {
    id: "REQ-001",
    title: "Dashboard export broken on Safari",
    status: "shipped",
    requestType: "bug",
    product: "DCC",
    module: "Dashboard",
    urgency: "high",
    description:
      "When attempting to export the dashboard as a PDF or CSV in Safari (macOS 14+), the download never starts. The browser shows a brief loading indicator but nothing is saved. Works fine in Chrome and Firefox. Reproducible on both Safari 17.2 and 17.4.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    attachmentCount: 2,
    comments: [
      {
        id: "c1",
        author: "Sarah (PM)",
        body: "Confirmed — Safari blocks cross-origin blob downloads without explicit CORS headers. Fix is in review now.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 8).toISOString(),
      },
      {
        id: "c2",
        author: "You",
        body: "Great, thanks for the quick turnaround!",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      },
    ],
    statusHistory: [
      { step: "submitted", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12) },
      { step: "in_review", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10) },
      { step: "in_sprint", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6) },
      { step: "shipped", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) },
    ],
  },
  {
    id: "REQ-002",
    title: "Add filter by assignee to Pipeline view",
    status: "in_sprint",
    requestType: "enhancement",
    product: "DCC",
    module: "Pipeline",
    urgency: "medium",
    description:
      "The pipeline view currently shows all deals regardless of who they are assigned to. We need a way to filter by assignee so reps can focus on their own pipeline without the noise of the full team's deals.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5),
    attachmentCount: 0,
    comments: [
      {
        id: "c3",
        author: "Marcus (Dev)",
        body: "Picked this up in the current sprint. ETA end of week.",
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1).toISOString(),
      },
    ],
    statusHistory: [
      { step: "submitted", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5) },
      { step: "in_review", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3) },
      { step: "in_sprint", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1) },
      { step: "shipped" },
    ],
  },
  {
    id: "REQ-003",
    title: "Monthly deal volume report",
    status: "submitted",
    requestType: "data_reporting",
    product: "SCT",
    module: "Dashboard",
    urgency: "low",
    description:
      "We need a monthly summary report that shows total deal volume broken down by product line, rep, and region. Should be exportable to Excel and automatically emailed to team leads on the 1st of each month.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    attachmentCount: 1,
    comments: [],
    statusHistory: [
      { step: "submitted", completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1) },
      { step: "in_review" },
      { step: "in_sprint" },
      { step: "shipped" },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  if (mins > 0) return `${mins} min${mins !== 1 ? "s" : ""} ago`;
  return "just now";
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  clarification_needed: "Clarification Needed",
  pending: "Pending",
  in_review: "In Review",
  in_sprint: "In Progress",
  in_progress: "In Progress",
  blocked: "Blocked",
  shipped: "Shipped",
  wont_fix: "Won't Fix",
  next_phase: "Next Phase",
};

const STATUS_CLASSES: Record<RequestStatus, string> = {
  submitted: "bg-amber-100 text-amber-800 border border-amber-300",
  clarification_needed: "bg-orange-100 text-orange-800 border border-orange-300",
  pending: "bg-blue-100 text-blue-800 border border-blue-300",
  in_review: "bg-blue-100 text-blue-800 border border-blue-300",
  in_sprint: "bg-violet-100 text-violet-800 border border-violet-300",
  in_progress: "bg-violet-100 text-violet-800 border border-violet-300",
  blocked: "bg-red-100 text-red-800 border border-red-300",
  shipped: "bg-green-100 text-green-800 border border-green-300",
  wont_fix: "bg-gray-100 text-gray-600 border border-gray-300",
  next_phase: "bg-gray-100 text-gray-600 border border-gray-300",
};

const TYPE_LABELS: Record<RequestType, string> = {
  bug: "Bug",
  enhancement: "Enhancement",
  new_feature: "New Feature",
  data_reporting: "Data / Reporting",
  process_change: "Process Change",
  sponsor_build: "Sponsor Build",
};

const URGENCY_CLASSES: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border border-red-300",
  high: "bg-orange-100 text-orange-800 border border-orange-300",
  medium: "bg-amber-100 text-amber-800 border border-amber-300",
  low: "bg-green-100 text-green-800 border border-green-300",
};

const TIMELINE_STEPS: { key: "submitted" | "in_review" | "in_sprint" | "shipped"; label: string }[] = [
  { key: "submitted", label: "Submitted" },
  { key: "in_review", label: "In Review" },
  { key: "in_sprint", label: "In Progress" },
  { key: "shipped", label: "Shipped" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusPill({ status }: { status: RequestStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-label-sm text-label-sm ${STATUS_CLASSES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function RequestListItem({
  request,
  selected,
  onClick,
}: {
  request: SponsorRequest;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-inverse-surface bg-inverse-surface text-inverse-on-surface"
          : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`shrink-0 font-mono text-xs ${
            selected ? "text-inverse-on-surface/70" : "text-on-surface-variant"
          }`}
        >
          {request.id}
        </span>
        <StatusPill status={request.status} />
      </div>
      <p
        className={`mt-1 truncate font-label-md text-label-md ${
          selected ? "text-inverse-on-surface" : "text-on-surface"
        }`}
      >
        {request.title}
      </p>
      <div
        className={`mt-1.5 flex items-center gap-2 font-body-sm text-body-sm ${
          selected ? "text-inverse-on-surface/60" : "text-on-surface-variant"
        }`}
      >
        <span>{relativeTime(request.createdAt)}</span>
        <span>·</span>
        <span>
          {request.product} › {request.module}
        </span>
      </div>
    </button>
  );
}

function Timeline({ request }: { request: SponsorRequest }) {
  // Find the index of the last completed step
  const lastCompletedIdx = (() => {
    let last = -1;
    TIMELINE_STEPS.forEach((step, idx) => {
      const hist = request.statusHistory.find((s) => s.step === step.key);
      if (hist?.completedAt) last = idx;
    });
    return last;
  })();

  const currentStepIndex = lastCompletedIdx < TIMELINE_STEPS.length - 1 ? lastCompletedIdx + 1 : lastCompletedIdx;

  return (
    <div className="flex flex-col">
      {TIMELINE_STEPS.map((step, idx) => {
        const hist = request.statusHistory.find((s) => s.step === step.key);
        const done = !!hist?.completedAt;
        const isCurrent = !done && idx === currentStepIndex;

        return (
          <div key={step.key} className="flex items-stretch gap-3">
            {/* Icon + connector line */}
            <div className="flex flex-col items-center">
              <div
                className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all ${
                  done
                    ? "bg-green-500 text-white"
                    : isCurrent
                    ? "bg-violet-500 text-white ring-4 ring-violet-200 animate-pulse"
                    : "border-2 border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                }`}
              >
                {done ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 14, fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : isCurrent ? (
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    pending
                  </span>
                ) : (
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                    radio_button_unchecked
                  </span>
                )}
              </div>
              {idx < TIMELINE_STEPS.length - 1 && (
                <div
                  className={`mt-0.5 w-0.5 flex-1 rounded-full ${done ? "bg-green-300" : "bg-outline-variant"}`}
                  style={{ minHeight: 24 }}
                />
              )}
            </div>

            {/* Label + timestamp */}
            <div className="pb-5 pt-0.5">
              <p
                className={`font-label-md text-label-md ${
                  done
                    ? "text-on-surface"
                    : isCurrent
                    ? "text-violet-700 font-semibold"
                    : "text-on-surface-variant"
                }`}
              >
                {step.label}
              </p>
              {done && hist?.completedAt && (
                <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">
                  {relativeTime(hist.completedAt)}
                </p>
              )}
              {isCurrent && (
                <p className="mt-0.5 font-body-sm text-body-sm text-violet-600">In progress…</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RequestDetail({
  request,
  onCommentAdded,
}: {
  request: SponsorRequest;
  onCommentAdded: (id: string, comment: Comment) => void;
}) {
  const [commentText, setCommentText] = useState("");

  function handleSubmitComment() {
    const trimmed = commentText.trim();
    if (!trimmed) return;
    const newComment: Comment = {
      id: `c-${Date.now()}`,
      author: "You",
      body: trimmed,
      timestamp: new Date().toISOString(),
    };
    onCommentAdded(request.id, newComment);
    setCommentText("");
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3 border-b border-outline-variant px-6 py-5 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm text-on-surface-variant">{request.id}</span>
            <StatusPill status={request.status} />
          </div>
          <h2 className="mt-1 font-label-lg text-label-lg text-on-surface leading-snug">
            {request.title}
          </h2>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6 min-w-0">
          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                label
              </span>
              {TYPE_LABELS[request.requestType]}
            </span>
            <span
              className={`inline-flex items-center rounded-lg px-2.5 py-1 font-label-sm text-label-sm ${URGENCY_CLASSES[request.urgency]}`}
            >
              {request.urgency.charAt(0).toUpperCase() + request.urgency.slice(1)} urgency
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-outline-variant bg-surface-container-low px-2.5 py-1 font-label-sm text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                account_tree
              </span>
              {request.product} › {request.module}
              {request.submodule ? ` › ${request.submodule}` : ""}
            </span>
          </div>

          {/* Description */}
          <div>
            <h3 className="mb-2 font-label-md text-label-md text-on-surface">Description</h3>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              {request.description}
            </p>
          </div>

          {/* Attachments */}
          <div>
            <h3 className="mb-2 font-label-md text-label-md text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                attach_file
              </span>
              Attachments
              {request.attachmentCount > 0 && (
                <span className="ml-1 rounded-full bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                  {request.attachmentCount}
                </span>
              )}
            </h3>
            {request.attachmentCount === 0 ? (
              <p className="font-body-sm text-body-sm text-on-surface-variant">No attachments</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {Array.from({ length: request.attachmentCount }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 font-body-sm text-body-sm text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      description
                    </span>
                    <span>attachment_{i + 1}.png</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ask a question */}
          <div>
            <h3 className="mb-2 font-label-md text-label-md text-on-surface">Ask a question</h3>
            <textarea
              rows={3}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Type a question or comment…"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] resize-none"
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>

          {/* Comments list */}
          {request.comments.length > 0 && (
            <div className="flex flex-col gap-3">
              <h3 className="font-label-md text-label-md text-on-surface">Comments</h3>
              {request.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-label-sm text-label-sm text-on-surface">{comment.author}</span>
                    <span className="font-body-sm text-body-sm text-on-surface-variant">
                      {formatTimestamp(comment.timestamp)}
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant">{comment.body}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timeline sidebar */}
        <div className="w-64 shrink-0 border-l border-outline-variant overflow-y-auto px-5 py-5">
          <h3 className="mb-4 font-label-md text-label-md text-on-surface">Progress</h3>
          <Timeline request={request} />
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function SponsorPortalPage() {
  const [requests, setRequests] = useState<SponsorRequest[]>(SEED_REQUESTS);
  const [selectedId, setSelectedId] = useState<string | null>("REQ-001");

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null;

  function handleCommentAdded(requestId: string, comment: Comment) {
    setRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, comments: [...r.comments, comment] } : r))
    );
  }

  return (
    <div className="flex h-full overflow-hidden bg-background-alt">
      {/* ── Left panel ── */}
      <div className="flex w-[35%] min-w-[280px] max-w-[420px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-lowest">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-4 shrink-0">
          <h1 className="font-label-lg text-label-lg text-on-surface">My Requests</h1>
          <Link
            to="/requests/new"
            className="flex items-center gap-1 rounded-xl bg-primary-container px-3 py-1.5 font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              add
            </span>
            New Request
          </Link>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          {requests.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant opacity-30">
                confirmation_number
              </span>
              <p className="font-body-md text-body-md text-on-surface-variant">
                No requests yet. Submit your first one.
              </p>
              <Link
                to="/requests/new"
                className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors"
              >
                New Request
              </Link>
            </div>
          ) : (
            requests.map((req) => (
              <RequestListItem
                key={req.id}
                request={req}
                selected={selectedId === req.id}
                onClick={() => setSelectedId(req.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedRequest ? (
          <RequestDetail request={selectedRequest} onCommentAdded={handleCommentAdded} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-[64px] opacity-20">receipt_long</span>
            <p className="font-body-md text-body-md opacity-50">Select a request to see details</p>
          </div>
        )}
      </div>
    </div>
  );
}
