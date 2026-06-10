/**
 * BuildTrack — Ticket Detail
 * Full-page view of a single request. Uses useParams() for the ticket ID.
 * All state is local — no API calls.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestStatus =
  | "submitted"
  | "pending"
  | "in_review"
  | "in_sprint"
  | "in_progress"
  | "blocked"
  | "shipped"
  | "wont_fix";

type RequestType =
  | "bug"
  | "enhancement"
  | "new_feature"
  | "data_reporting"
  | "process_change"
  | "sponsor_build";

type Priority = "P0" | "P1" | "P2" | "P3";

type DevStage = "picked_up" | "in_progress" | "blocked" | "done";

interface Comment {
  id: string;
  author: string;
  body: string;
  timestamp: Date;
}

interface AiRecommendation {
  suggestedPriority: Priority;
  suggestedCategory: string;
  suggestedAssignee: string;
  confidence: number; // 0-100
  reasoning: string;
}

interface FullTicket {
  shortId: string;
  title: string;
  description: string;
  status: RequestStatus;
  type: RequestType;
  priority: Priority;
  product: string;
  module: string;
  assignee: string;
  sponsor: string;
  createdAt: Date;
  attachmentCount: number;
  devStage: DevStage;
  comments: Comment[];
  aiRecommendation: AiRecommendation;
}

// ─── Seed data ────────────────────────────────────────────────────────────────

const now = Date.now();
const daysAgo = (d: number) => new Date(now - 1000 * 60 * 60 * 24 * d);
const hoursAgo = (h: number) => new Date(now - 1000 * 60 * 60 * h);

const TICKETS: FullTicket[] = [
  {
    shortId: "REQ-001",
    title: "Dashboard export broken on Safari",
    description:
      "When attempting to export the dashboard as a PDF or CSV in Safari (macOS 14+), the download never starts. The browser shows a brief loading indicator but nothing is saved. Works fine in Chrome and Firefox. Reproducible on both Safari 17.2 and 17.4. Affects all DCC dashboard views including pipeline summary and deal volume.",
    status: "shipped",
    type: "bug",
    priority: "P1",
    product: "DCC",
    module: "Dashboard",
    assignee: "Hari",
    sponsor: "Priya Nair",
    createdAt: daysAgo(12),
    attachmentCount: 2,
    devStage: "done",
    comments: [
      {
        id: "c1",
        author: "Sarah (PM)",
        body: "Confirmed — Safari blocks cross-origin blob downloads without explicit CORS headers. Fix is in review now.",
        timestamp: daysAgo(8),
      },
      {
        id: "c2",
        author: "Hari",
        body: "Added the required CORS headers on the export endpoint and switched to a same-origin blob URL approach. Deployed to staging — please verify.",
        timestamp: daysAgo(5),
      },
      {
        id: "c3",
        author: "Priya Nair",
        body: "Verified on Safari 17.4. Export working perfectly now. Thanks for the quick fix!",
        timestamp: daysAgo(3),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P1",
      suggestedCategory: "Bug — Browser Compatibility",
      suggestedAssignee: "Hari",
      confidence: 92,
      reasoning:
        "Export failures affecting a major browser in a frequently-used view meet P1 criteria. Safari-specific blob download behaviour is a known pattern — assigned to Hari based on prior dashboard work.",
    },
  },
  {
    shortId: "REQ-002",
    title: "Add filter by assignee to Pipeline view",
    description:
      "Currently the Pipeline view shows all deals regardless of assigned rep. Managers and reps want to be able to filter by assignee so each rep can see just their deals. The filter should support multi-select. Ideally persisted in URL params so the view can be shared.",
    status: "in_sprint",
    type: "enhancement",
    priority: "P2",
    product: "DCC",
    module: "Pipeline",
    assignee: "Hari",
    sponsor: "James Okafor",
    createdAt: daysAgo(5),
    attachmentCount: 0,
    devStage: "in_progress",
    comments: [
      {
        id: "c1",
        author: "James Okafor",
        body: "This is blocking our weekly pipeline review — reps have to mentally filter 40+ deals. High value, even a simple dropdown would help.",
        timestamp: daysAgo(4),
      },
      {
        id: "c2",
        author: "Hari",
        body: "Working on a multi-select filter component. Will use URL search params for shareability. ETA: end of sprint.",
        timestamp: daysAgo(1),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P2",
      suggestedCategory: "Enhancement — Filtering & Search",
      suggestedAssignee: "Hari",
      confidence: 85,
      reasoning:
        "Multi-select filtering is a medium-complexity enhancement. URL persistence adds value without significant overhead. P2 aligns with sprint priority.",
    },
  },
  {
    shortId: "REQ-003",
    title: "Monthly deal volume report",
    description:
      "Need a monthly deal volume report that aggregates deals closed per rep per month. The report should be exportable to CSV and show month-over-month trends. This is needed for the quarterly business review with leadership.",
    status: "submitted",
    type: "data_reporting",
    priority: "P3",
    product: "SCT",
    module: "Dashboard",
    assignee: "Unassigned",
    sponsor: "Meera Joshi",
    createdAt: daysAgo(1),
    attachmentCount: 1,
    devStage: "picked_up",
    comments: [
      {
        id: "c1",
        author: "Rishabh PM",
        body: "Adding to triage. Will review data model requirements with the SCT team this week.",
        timestamp: hoursAgo(6),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P3",
      suggestedCategory: "Data Reporting — Aggregation",
      suggestedAssignee: "Marcus Dev",
      confidence: 78,
      reasoning:
        "Monthly aggregation reports are low urgency but recurring in value. P3 appropriate for next sprint consideration. Marcus has built similar SCT reports previously.",
    },
  },
  {
    shortId: "REQ-004",
    title: "Sequence email open rate not tracking",
    description:
      "Email open rate tracking has stopped working for sequences created after November 15th. Older sequences still show correct data. The issue appears related to the pixel tracking domain change that went live on Nov 14th. Open events are not appearing in the SCT analytics dashboard, although sends and clicks are still recorded correctly.",
    status: "blocked",
    type: "bug",
    priority: "P0",
    product: "SCT",
    module: "Sequence Management",
    assignee: "Hari",
    sponsor: "Divya Ramesh",
    createdAt: daysAgo(3),
    attachmentCount: 0,
    devStage: "blocked",
    comments: [
      {
        id: "c1",
        author: "Divya Ramesh",
        body: "This is critical — our open rate data feeds directly into rep performance reviews. We need this fixed before end of week.",
        timestamp: daysAgo(3),
      },
      {
        id: "c2",
        author: "Hari",
        body: "Root cause identified: tracking pixel domain change broke CORS policy on the open-event endpoint. Blocked on SCT API team providing updated credentials for the new domain.",
        timestamp: daysAgo(1),
      },
      {
        id: "c3",
        author: "Rishabh PM",
        body: "Escalated to SCT API team. Expected resolution within 24 hours. Hari will unblock and deploy fix immediately after.",
        timestamp: hoursAgo(4),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P0",
      suggestedCategory: "Bug — Data Tracking",
      suggestedAssignee: "Hari",
      confidence: 97,
      reasoning:
        "Loss of open rate tracking directly impacts rep performance reporting. The timing correlation with the domain change strongly indicates a known CORS/pixel tracking pattern. P0 warranted — data loss scenario.",
    },
  },
  {
    shortId: "REQ-005",
    title: "New onboarding flow for reps",
    description:
      "Build a guided onboarding experience for new sales reps. Should include: welcome screen, DCC walkthrough tour, first deal creation wizard, and a checklist of setup tasks (connect email, set up sequences, etc). Goal is to reduce time-to-first-deal for new reps from 2 weeks to 3 days.",
    status: "pending",
    type: "new_feature",
    priority: "P2",
    product: "Hiring Tool",
    module: "Ops Tool",
    assignee: "Unassigned",
    sponsor: "Ananya Kumar",
    createdAt: daysAgo(7),
    attachmentCount: 3,
    devStage: "picked_up",
    comments: [
      {
        id: "c1",
        author: "Ananya Kumar",
        body: "Attached Figma mockups for the onboarding flow. Let me know if you need further context on the checklist items.",
        timestamp: daysAgo(6),
      },
      {
        id: "c2",
        author: "Rishabh PM",
        body: "This is a substantial scope. Will need to break into phases. Phase 1: welcome + tour. Phase 2: deal wizard. Phase 3: checklist. Scheduling design review.",
        timestamp: daysAgo(5),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P2",
      suggestedCategory: "New Feature — Onboarding",
      suggestedAssignee: "Marcus Dev",
      confidence: 72,
      reasoning:
        "Onboarding flows are high-value but complex. P2 is appropriate given the phased approach. Marcus has experience with wizard-style UI patterns from the deal creation flow.",
    },
  },
  {
    shortId: "REQ-006",
    title: "Export deals to Excel",
    description:
      "Reps and managers need to export the current deal list (with all visible columns and applied filters) to an Excel file (.xlsx). The export should respect the current filter state and column configuration. Include headers, and format currency and date fields appropriately.",
    status: "in_sprint",
    type: "data_reporting",
    priority: "P2",
    product: "DCC",
    module: "Deal Details",
    assignee: "Hari",
    sponsor: "James Okafor",
    createdAt: daysAgo(4),
    attachmentCount: 0,
    devStage: "in_progress",
    comments: [
      {
        id: "c1",
        author: "James Okafor",
        body: "Reps are currently screenshotting the deals table. Excel export is a must-have for monthly reporting.",
        timestamp: daysAgo(4),
      },
      {
        id: "c2",
        author: "Hari",
        body: "Using the SheetJS library approach but keeping it lightweight. Column config and filter state will be passed to the export function. Working on currency/date formatting now.",
        timestamp: hoursAgo(10),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P2",
      suggestedCategory: "Data Reporting — Export",
      suggestedAssignee: "Hari",
      confidence: 88,
      reasoning:
        "Deal export with filter awareness is a well-scoped feature. P2 correct. Hari has context from the Safari export fix and knows the export pipeline.",
    },
  },
  {
    shortId: "REQ-007",
    title: "Reply dashboard date range filter",
    description:
      "The reply dashboard currently only shows data for the last 30 days with no way to change the range. Users need to be able to select custom date ranges (presets: 7d, 30d, 90d, custom). This is needed for historical trend analysis.",
    status: "submitted",
    type: "enhancement",
    priority: "P3",
    product: "SCT",
    module: "Reply Dashboard",
    assignee: "Unassigned",
    sponsor: "Vikram Shetty",
    createdAt: daysAgo(2),
    attachmentCount: 0,
    devStage: "picked_up",
    comments: [
      {
        id: "c1",
        author: "Vikram Shetty",
        body: "We're trying to compare this quarter's reply rates against last quarter. The 30-day limit is a blocker for that analysis.",
        timestamp: daysAgo(2),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P3",
      suggestedCategory: "Enhancement — Date Filtering",
      suggestedAssignee: "Marcus Dev",
      confidence: 81,
      reasoning:
        "Date range filtering is a common enhancement pattern. P3 given no active blocking. Marcus built the existing reply dashboard date logic.",
    },
  },
  {
    shortId: "REQ-008",
    title: "Integrate Slack notifications for deal stage change",
    description:
      "When a deal moves to a new stage in DCC Pipeline, automatically send a Slack notification to the assigned rep and their manager. Message should include: deal name, previous stage, new stage, and a link to the deal. Configurable per-user opt-in.",
    status: "pending",
    type: "process_change",
    priority: "P1",
    product: "DCC",
    module: "Pipeline",
    assignee: "Rishabh PM",
    sponsor: "Meera Joshi",
    createdAt: daysAgo(6),
    attachmentCount: 1,
    devStage: "picked_up",
    comments: [
      {
        id: "c1",
        author: "Meera Joshi",
        body: "Managers are currently missing deal stage changes because they only check DCC weekly. Slack notifications would close that loop immediately.",
        timestamp: daysAgo(6),
      },
      {
        id: "c2",
        author: "Rishabh PM",
        body: "Need to evaluate Slack webhook approach vs bot token. Also need to design the opt-in UX. Will spec this out.",
        timestamp: daysAgo(4),
      },
    ],
    aiRecommendation: {
      suggestedPriority: "P1",
      suggestedCategory: "Process Change — Notifications",
      suggestedAssignee: "Marcus Dev",
      confidence: 83,
      reasoning:
        "Real-time deal notifications address a clear visibility gap for managers. P1 appropriate given business impact. Marcus integrated the previous Slack webhook for the hiring tool.",
    },
  },
];

const TICKET_MAP = Object.fromEntries(TICKETS.map((t) => [t.shortId, t]));

// ─── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted: "Submitted",
  pending: "In Review",
  in_review: "In Review",
  in_sprint: "In Progress",
  in_progress: "In Progress",
  blocked: "Blocked",
  shipped: "Shipped",
  wont_fix: "Won't Fix",
};

const STATUS_CLASSES: Record<RequestStatus, string> = {
  submitted: "bg-amber-100 text-amber-800 border border-amber-300",
  pending: "bg-blue-100 text-blue-800 border border-blue-300",
  in_review: "bg-blue-100 text-blue-800 border border-blue-300",
  in_sprint: "bg-violet-100 text-violet-800 border border-violet-300",
  in_progress: "bg-violet-100 text-violet-800 border border-violet-300",
  blocked: "bg-red-100 text-red-800 border border-red-300",
  shipped: "bg-green-100 text-green-800 border border-green-300",
  wont_fix: "bg-gray-100 text-gray-600 border border-gray-300",
};

const TYPE_LABELS: Record<RequestType, string> = {
  bug: "Bug",
  enhancement: "Enhancement",
  new_feature: "New Feature",
  data_reporting: "Data Reporting",
  process_change: "Process Change",
  sponsor_build: "Sponsor Build",
};

const PRIORITY_CLASSES: Record<Priority, string> = {
  P0: "bg-red-100 text-red-700 border border-red-300",
  P1: "bg-orange-100 text-orange-700 border border-orange-300",
  P2: "bg-amber-100 text-amber-700 border border-amber-300",
  P3: "bg-green-100 text-green-700 border border-green-300",
};

const DEV_STAGES: { stage: DevStage; label: string; icon: string }[] = [
  { stage: "picked_up", label: "Picked Up", icon: "pan_tool" },
  { stage: "in_progress", label: "In Progress", icon: "pending" },
  { stage: "blocked", label: "Blocked", icon: "block" },
  { stage: "done", label: "Done", icon: "check_circle" },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

const AVATAR_PALETTE: Record<string, string> = {
  A: "bg-rose-200 text-rose-800",
  B: "bg-orange-200 text-orange-800",
  C: "bg-amber-200 text-amber-800",
  D: "bg-yellow-200 text-yellow-800",
  E: "bg-lime-200 text-lime-800",
  F: "bg-green-200 text-green-800",
  G: "bg-emerald-200 text-emerald-800",
  H: "bg-teal-200 text-teal-800",
  I: "bg-cyan-200 text-cyan-800",
  J: "bg-sky-200 text-sky-800",
  K: "bg-blue-200 text-blue-800",
  L: "bg-indigo-200 text-indigo-800",
  M: "bg-violet-200 text-violet-800",
  N: "bg-purple-200 text-purple-800",
  O: "bg-fuchsia-200 text-fuchsia-800",
  P: "bg-pink-200 text-pink-800",
  Q: "bg-red-200 text-red-800",
  R: "bg-orange-300 text-orange-900",
  S: "bg-amber-300 text-amber-900",
  T: "bg-lime-300 text-lime-900",
  U: "bg-green-300 text-green-900",
  V: "bg-teal-300 text-teal-900",
  W: "bg-cyan-300 text-cyan-900",
  X: "bg-sky-300 text-sky-900",
  Y: "bg-blue-300 text-blue-900",
  Z: "bg-indigo-300 text-indigo-900",
};

function avatarClasses(name: string): string {
  const key = name.charAt(0).toUpperCase();
  return AVATAR_PALETTE[key] ?? "bg-surface-container text-on-surface";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0] ?? "").charAt(0).toUpperCase();
  return ((parts[0] ?? "").charAt(0) + (parts[parts.length - 1] ?? "").charAt(0)).toUpperCase();
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "h-7 w-7 text-[11px]" : size === "lg" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClass} ${avatarClasses(name)}`}>
      {initials(name)}
    </span>
  );
}

function SidebarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant opacity-60">
        {label}
      </span>
      <div className="text-sm text-on-surface">{children}</div>
    </div>
  );
}

// ─── Dev stage stepper (horizontal) ──────────────────────────────────────────

interface DevStepperProps {
  current: DevStage;
  onChange: (stage: DevStage) => void;
}

function DevStepper({ current, onChange }: DevStepperProps) {
  const currentIdx = DEV_STAGES.findIndex((s) => s.stage === current);

  return (
    <div className="flex items-center gap-0">
      {DEV_STAGES.map((s, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isClickable = idx <= currentIdx + 1 && !isCurrent;

        let dotClass = "border-2 border-outline-variant bg-surface-container text-on-surface-variant";
        let labelClass = "text-on-surface-variant opacity-50";

        if (isPast) {
          dotClass = "bg-green-500 text-white border-2 border-green-500";
          labelClass = "text-green-700";
        } else if (isCurrent) {
          const accentMap: Record<DevStage, string> = {
            picked_up: "bg-blue-500 text-white border-2 border-blue-500",
            in_progress: "bg-violet-500 text-white border-2 border-violet-500",
            blocked: "bg-red-500 text-white border-2 border-red-500",
            done: "bg-green-500 text-white border-2 border-green-500",
          };
          const labelAccentMap: Record<DevStage, string> = {
            picked_up: "text-blue-700 font-semibold",
            in_progress: "text-violet-700 font-semibold",
            blocked: "text-red-700 font-semibold",
            done: "text-green-700 font-semibold",
          };
          dotClass = accentMap[s.stage];
          labelClass = labelAccentMap[s.stage];
        }

        return (
          <div key={s.stage} className="flex items-center">
            {/* Step */}
            <button
              disabled={!isClickable && !isCurrent}
              onClick={() => {
                if (isClickable) onChange(s.stage);
              }}
              className={`flex flex-col items-center gap-1.5 px-1 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
              title={isClickable ? `Move to ${s.label}` : s.label}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${dotClass}`}>
                {isPast ? (
                  <span className="material-symbols-outlined text-[16px]">check</span>
                ) : (
                  <span className="material-symbols-outlined text-[16px]">{s.icon}</span>
                )}
              </div>
              <span className={`text-[11px] whitespace-nowrap ${labelClass}`}>{s.label}</span>
            </button>

            {/* Connector line */}
            {idx < DEV_STAGES.length - 1 && (
              <div className={`h-0.5 w-8 shrink-0 ${idx < currentIdx ? "bg-green-400" : "bg-outline-variant"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── AI Recommendation card ───────────────────────────────────────────────────

function AiRecommendationCard({ rec }: { rec: AiRecommendation }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="material-symbols-outlined text-[18px] text-amber-600">auto_awesome</span>
        <span className="flex-1 text-sm font-semibold text-amber-900">AI Recommendation</span>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          {rec.confidence}% confident
        </span>
        <span className="material-symbols-outlined text-[18px] text-amber-600">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-amber-200 px-4 py-3 flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 opacity-70">
                Suggested Priority
              </p>
              <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${PRIORITY_CLASSES[rec.suggestedPriority]}`}>
                {rec.suggestedPriority}
              </span>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 opacity-70">
                Suggested Assignee
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <Avatar name={rec.suggestedAssignee} size="sm" />
                <span className="text-xs text-amber-900">{rec.suggestedAssignee}</span>
              </div>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 opacity-70">
              Category
            </p>
            <p className="mt-0.5 text-xs text-amber-900">{rec.suggestedCategory}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 opacity-70">
              Reasoning
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-amber-900">{rec.reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Comments section ─────────────────────────────────────────────────────────

interface CommentsProps {
  initial: Comment[];
}

function CommentsSection({ initial }: CommentsProps) {
  const [comments, setComments] = useState<Comment[]>(initial);
  const [draft, setDraft] = useState("");

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setComments((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        author: "Hari",
        body,
        timestamp: new Date(),
      },
    ]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-base font-semibold text-on-surface">Comments & Activity</h2>

      {/* Existing comments */}
      <div className="flex flex-col gap-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar name={c.author} size="md" />
            <div className="flex flex-1 flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-semibold text-on-surface">{c.author}</span>
                <span className="text-xs text-on-surface-variant opacity-50">{relativeTime(c.timestamp)}</span>
              </div>
              <p className="text-sm leading-relaxed text-on-surface">{c.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add comment */}
      <div className="flex gap-3">
        <Avatar name="Hari" size="md" />
        <div className="flex flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            className="w-full resize-none rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
            }}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Comment
            </button>
            <span className="text-xs text-on-surface-variant opacity-40">⌘ + Enter to submit</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      className="pointer-events-auto fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-5 py-3 text-sm text-on-surface shadow-lg"
      onClick={onDismiss}
    >
      <span className="material-symbols-outlined text-[18px] text-on-surface-variant">info</span>
      {message}
    </div>
  );
}

// ─── Not found ────────────────────────────────────────────────────────────────

function NotFound({ id }: { id: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-on-surface-variant">
      <span className="material-symbols-outlined text-[56px] opacity-20">search_off</span>
      <div className="text-center">
        <p className="font-semibold text-on-surface">Ticket not found</p>
        <p className="mt-1 text-sm opacity-60">
          No ticket with ID <span className="font-mono font-medium">{id}</span> exists in seed data.
        </p>
      </div>
      <Link
        to="/requests"
        className="inline-flex items-center gap-1.5 rounded-xl border border-outline-variant px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-low transition-colors"
      >
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Requests
      </Link>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const normalizedId = id?.toUpperCase() ?? "";
  const ticketData = TICKET_MAP[normalizedId] ?? null;

  const [devStage, setDevStage] = useState<DevStage>(ticketData?.devStage ?? "picked_up");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  if (!ticketData) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
          <span className="material-symbols-outlined text-[15px]">warning</span>
          Not connected to API — showing seed data only.
        </div>
        <NotFound id={id ?? "(none)"} />
      </div>
    );
  }

  const ticket = ticketData;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Amber API banner */}
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-6 py-2 text-xs text-amber-800">
        <span className="material-symbols-outlined text-[15px]">warning</span>
        Not connected to API — showing seed data only.
      </div>

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-auto bg-background-alt">
        <div className="mx-auto max-w-screen-xl px-6 py-8">
          <div className="flex gap-8">
            {/* ── Left column (65%) ── */}
            <div className="flex min-w-0 flex-1 flex-col gap-8" style={{ flexBasis: "65%" }}>
              {/* Breadcrumb */}
              <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
                <Link
                  to="/requests"
                  className="inline-flex items-center gap-1 hover:text-on-surface transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                  Requests
                </Link>
                <span className="opacity-40">/</span>
                <span className="font-mono font-medium text-on-surface">{ticket.shortId}</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl font-semibold leading-tight text-on-surface">
                {ticket.title}
              </h1>

              {/* Description */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
                <h2 className="mb-3 text-sm font-semibold text-on-surface-variant">Description</h2>
                <p className="text-sm leading-relaxed text-on-surface">{ticket.description}</p>
              </div>

              {/* Dev stage tracker */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
                <h2 className="mb-5 text-sm font-semibold text-on-surface-variant">Dev Progress</h2>
                <div className="flex items-start">
                  <DevStepper
                    current={devStage}
                    onChange={(stage) => setDevStage(stage)}
                  />
                </div>
                <p className="mt-4 text-xs text-on-surface-variant opacity-50">
                  Click the next step to advance the dev stage. Local only — no API call.
                </p>
              </div>

              {/* Comments & Activity */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-6">
                <CommentsSection initial={ticket.comments} />
              </div>
            </div>

            {/* ── Right column (35%) ── */}
            <div className="shrink-0 flex flex-col gap-4" style={{ flexBasis: "35%", minWidth: "280px", maxWidth: "380px" }}>
              {/* Metadata card */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col gap-5">
                <SidebarRow label="Status">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </SidebarRow>

                <SidebarRow label="Priority">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${PRIORITY_CLASSES[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </SidebarRow>

                <SidebarRow label="Type">
                  <span className="inline-flex items-center rounded-full border border-outline-variant bg-surface-container-low px-2.5 py-0.5 text-xs text-on-surface-variant">
                    {TYPE_LABELS[ticket.type]}
                  </span>
                </SidebarRow>

                <SidebarRow label="Module">
                  <span className="text-sm text-on-surface">
                    {ticket.product} <span className="opacity-40">›</span> {ticket.module}
                  </span>
                </SidebarRow>

                <SidebarRow label="Assignee">
                  <div className="flex items-center gap-2">
                    <Avatar name={ticket.assignee} size="sm" />
                    <span className="text-sm text-on-surface">{ticket.assignee}</span>
                  </div>
                </SidebarRow>

                <SidebarRow label="Sponsor">
                  <span className="text-sm text-on-surface">{ticket.sponsor}</span>
                </SidebarRow>

                <SidebarRow label="Created">
                  <span className="text-sm text-on-surface">{formatDate(ticket.createdAt)}</span>
                </SidebarRow>

                <SidebarRow label="Attachments">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant opacity-60">
                      attach_file
                    </span>
                    <span className="text-sm text-on-surface">
                      {ticket.attachmentCount === 0
                        ? "No attachments"
                        : `${ticket.attachmentCount} file${ticket.attachmentCount > 1 ? "s" : ""}`}
                    </span>
                  </div>
                </SidebarRow>
              </div>

              {/* AI Recommendation */}
              <AiRecommendationCard rec={ticket.aiRecommendation} />

              {/* Asana task */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-60">
                    task_alt
                  </span>
                  <span className="text-sm font-semibold text-on-surface">Asana Task</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-on-surface-variant opacity-60">Not synced</span>
                  <button
                    onClick={() => showToast("Asana sync coming soon")}
                    className="inline-flex items-center gap-1 rounded-xl border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[14px]">sync</span>
                    Push to Asana
                  </button>
                </div>
              </div>

              {/* GitHub PRs */}
              <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-on-surface-variant opacity-60">
                    merge
                  </span>
                  <span className="text-sm font-semibold text-on-surface">GitHub PRs</span>
                </div>
                <p className="text-xs text-on-surface-variant opacity-60">No PRs linked</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
