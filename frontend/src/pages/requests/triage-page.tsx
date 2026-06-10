/**
 * BuildTrack — PM Triage Inbox
 * Shows AI-recommended priority/category/assignee for PM to approve/override/reject.
 * All state is local — zero API calls.
 */
import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestType =
  | "bug"
  | "enhancement"
  | "new_feature"
  | "data_reporting"
  | "process_change"
  | "sponsor_build";

type Urgency = "low" | "medium" | "high" | "critical";
type Priority = "P0" | "P1" | "P2" | "P3";
type Category = "Sprint Work" | "New Project" | "Immediate Bug Fix" | "Backlog";

type Decision = "approved" | "rejected" | "clarification";

interface AiRecommendation {
  priority: Priority;
  priorityRationale: string;
  category: Category;
  categoryRationale: string;
  assignee: string;
  assigneeRationale: string;
  confidence: number; // 0–100
}

interface InboxTicket {
  id: string;
  title: string;
  description: string;
  type: RequestType;
  urgency: Urgency;
  product: string;
  module: string;
  sponsor: string;
  createdAgo: string;
  ai: AiRecommendation;
}

interface TicketAction {
  decision: Decision;
  useAiRec: boolean;
  overridePriority: Priority;
  overrideCategory: Category;
  overrideAssignee: string;
  pmNotes: string;
}

interface Toast {
  id: number;
  message: string;
  icon: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TEAM_MEMBERS = ["Rishabh (PM)", "Hari (Sr Engineer)", "Marcus Dev", "Joshua (Admin)"];

const CATEGORIES: Category[] = ["Sprint Work", "New Project", "Immediate Bug Fix", "Backlog"];

const PRIORITIES: Priority[] = ["P0", "P1", "P2", "P3"];

// ─── Seed data ────────────────────────────────────────────────────────────────

const INBOX: InboxTicket[] = [
  {
    id: "REQ-009",
    title: "Pipeline stage stuck after manual edit",
    description:
      "When a rep manually edits a deal stage via the dropdown, the pipeline card freezes and the stage does not update in the database. Hard refresh is required. Affects all reps on DCC pipeline view. Regression introduced ~3 hours ago.",
    type: "bug",
    urgency: "critical",
    product: "DCC",
    module: "Pipeline",
    sponsor: "Sam Park",
    createdAgo: "3 hours ago",
    ai: {
      priority: "P0",
      priorityRationale: "Critical regression. Users blocked from updating deals. Assign immediately.",
      category: "Immediate Bug Fix",
      categoryRationale: "Active production regression with full user impact.",
      assignee: "Marcus Dev",
      assigneeRationale: "Marcus knows the pipeline codebase and has context on recent deploys.",
      confidence: 96,
    },
  },
  {
    id: "REQ-005",
    title: "New onboarding flow for reps",
    description:
      "The current onboarding experience for new sales reps is fragmented across multiple tools. We need a unified, guided onboarding flow inside the Ops Tool that walks reps through CRM setup, sequence creation, and their first 30 days checklist.",
    type: "new_feature",
    urgency: "medium",
    product: "Hiring Tool",
    module: "Ops Tool",
    sponsor: "Jordan Lee",
    createdAgo: "7 days ago",
    ai: {
      priority: "P1",
      priorityRationale: "High-impact workflow change. Needs PM scoping before dev assignment.",
      category: "New Project",
      categoryRationale: "Multi-surface feature requiring design and PM alignment first.",
      assignee: "Rishabh (PM)",
      assigneeRationale: "Needs PM scoping before dev assignment. Rishabh owns Ops Tool.",
      confidence: 84,
    },
  },
  {
    id: "REQ-007",
    title: "Reply dashboard date range filter",
    description:
      "The Reply Dashboard currently shows a fixed 30-day window. Reps need to be able to select a custom date range (or preset: 7d, 14d, 30d, 90d) to analyse reply trends for specific campaigns.",
    type: "enhancement",
    urgency: "low",
    product: "SCT",
    module: "Reply Dashboard",
    sponsor: "Alex Chen",
    createdAgo: "2 days ago",
    ai: {
      priority: "P3",
      priorityRationale: "Well-scoped UI enhancement with no blocking dependencies.",
      category: "Sprint Work",
      categoryRationale: "Straightforward component addition — fits in a standard sprint.",
      assignee: "Marcus Dev",
      assigneeRationale: "Marcus knows the reply dashboard codebase.",
      confidence: 91,
    },
  },
  {
    id: "REQ-003",
    title: "Monthly deal volume report",
    description:
      "Sales leadership needs an automated monthly report showing total deal volume, conversion rates by stage, and rep-level performance breakdowns. Should be exportable as PDF/CSV and delivered via Slack.",
    type: "data_reporting",
    urgency: "low",
    product: "SCT",
    module: "Dashboard",
    sponsor: "Alex Chen",
    createdAgo: "1 day ago",
    ai: {
      priority: "P2",
      priorityRationale: "Standard reporting request, medium complexity.",
      category: "Sprint Work",
      categoryRationale: "Data pipeline + UI — fits sprint scope once Hari reviews data layer.",
      assignee: "Hari (Sr Engineer)",
      assigneeRationale: "Hari owns the SCT data layer and reporting infrastructure.",
      confidence: 72,
    },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeBadge(type: RequestType) {
  const map: Record<RequestType, { label: string; cls: string }> = {
    bug: { label: "Bug", cls: "bg-red-100 text-red-700" },
    enhancement: { label: "Enhancement", cls: "bg-blue-100 text-blue-700" },
    new_feature: { label: "New Feature", cls: "bg-purple-100 text-purple-700" },
    data_reporting: { label: "Data / Reporting", cls: "bg-cyan-100 text-cyan-700" },
    process_change: { label: "Process Change", cls: "bg-orange-100 text-orange-700" },
    sponsor_build: { label: "Sponsor Build", cls: "bg-pink-100 text-pink-700" },
  };
  const { label, cls } = map[type];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function urgencyBadge(urgency: Urgency) {
  const map: Record<Urgency, { label: string; cls: string }> = {
    low: { label: "Low", cls: "bg-slate-100 text-slate-600" },
    medium: { label: "Medium", cls: "bg-amber-100 text-amber-700" },
    high: { label: "High", cls: "bg-orange-100 text-orange-700" },
    critical: { label: "Critical", cls: "bg-red-100 text-red-700 font-semibold" },
  };
  const { label, cls } = map[urgency];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function priorityBadge(priority: Priority, large = false) {
  const map: Record<Priority, string> = {
    P0: "bg-red-100 text-red-700",
    P1: "bg-orange-100 text-orange-700",
    P2: "bg-amber-100 text-amber-700",
    P3: "bg-green-100 text-green-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${map[priority]} ${
        large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
      }`}
    >
      {priority}
    </span>
  );
}

function confidenceBadge(confidence: number) {
  const cls =
    confidence >= 85
      ? "bg-green-100 text-green-700"
      : confidence >= 60
      ? "bg-amber-100 text-amber-700"
      : "bg-red-100 text-red-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {confidence}% confidence
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TriagePage() {
  const [selectedId, setSelectedId] = useState<string>(INBOX[0]?.id ?? "");
  const [actions, setActions] = useState<Record<string, TicketAction>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastCounter = useRef(0);

  // Per-ticket override state (reset when selection changes)
  const [useAiRec, setUseAiRec] = useState(true);
  const [overridePriority, setOverridePriority] = useState<Priority>("P2");
  const [overrideCategory, setOverrideCategory] = useState<Category>("Sprint Work");
  const [overrideAssignee, setOverrideAssignee] = useState(TEAM_MEMBERS[0] ?? "");
  const [pmNotes, setPmNotes] = useState("");

  const selectedTicket = INBOX.find((t) => t.id === selectedId)!;
  const unactionedCount = INBOX.filter((t) => !actions[t.id]).length;

  // Reset form when ticket changes
  useEffect(() => {
    setUseAiRec(true);
    setPmNotes("");
    if (selectedTicket) {
      setOverridePriority(selectedTicket.ai.priority);
      setOverrideCategory(selectedTicket.ai.category as Category);
      setOverrideAssignee(selectedTicket.ai.assignee);
    }
  }, [selectedId]);

  function addToast(message: string, icon: string) {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, message, icon }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }

  function advanceToNext(currentId: string) {
    const remaining = INBOX.filter((t) => !actions[t.id] && t.id !== currentId);
    if (remaining.length > 0 && remaining[0]) setSelectedId(remaining[0].id);
  }

  function handleApprove() {
    const action: TicketAction = {
      decision: "approved",
      useAiRec,
      overridePriority,
      overrideCategory,
      overrideAssignee,
      pmNotes,
    };
    setActions((prev) => ({ ...prev, [selectedId]: action }));
    addToast("Routed to sprint ✓", "check_circle");
    advanceToNext(selectedId);
  }

  function handleReject() {
    const action: TicketAction = {
      decision: "rejected",
      useAiRec,
      overridePriority,
      overrideCategory,
      overrideAssignee,
      pmNotes,
    };
    setActions((prev) => ({ ...prev, [selectedId]: action }));
    addToast("Marked Won't Fix", "cancel");
    advanceToNext(selectedId);
  }

  function handleClarification() {
    const action: TicketAction = {
      decision: "clarification",
      useAiRec,
      overridePriority,
      overrideCategory,
      overrideAssignee,
      pmNotes,
    };
    setActions((prev) => ({ ...prev, [selectedId]: action }));
    addToast(`Clarification request sent to ${selectedTicket.sponsor}`, "chat_bubble");
    advanceToNext(selectedId);
  }

  const currentAction = actions[selectedId];
  const allActioned = INBOX.every((t) => actions[t.id]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Not-connected banner ───────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        <span className="material-symbols-outlined text-[18px] text-amber-500">warning</span>
        <span className="font-medium">Not connected to API</span>
        <span className="text-amber-700">— all data is local seed data. Actions are simulated.</span>
      </div>

      {/* ── Main two-column split ──────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Left panel — inbox list ──────────────────────────────────────── */}
        <aside className="flex w-[40%] shrink-0 flex-col border-r border-outline-variant bg-background-alt">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-outline-variant px-4 py-3">
            <h2 className="text-base font-semibold text-on-surface">Triage Inbox</h2>
            {unactionedCount > 0 ? (
              <span className="inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                {unactionedCount}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Done
              </span>
            )}
          </div>

          {/* List */}
          <ul className="flex-1 overflow-y-auto divide-y divide-outline-variant">
            {INBOX.map((ticket) => {
              const action = actions[ticket.id];
              const isSelected = ticket.id === selectedId;
              const isActioned = !!action;

              return (
                <li key={ticket.id}>
                  <button
                    onClick={() => setSelectedId(ticket.id)}
                    className={`w-full cursor-pointer px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? "bg-inverse-surface text-inverse-on-surface"
                        : isActioned
                        ? "bg-surface-container-lowest opacity-50 hover:opacity-70"
                        : "hover:bg-surface-container-lowest"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-mono font-semibold ${
                              isSelected ? "text-inverse-on-surface opacity-70" : "text-on-surface-variant"
                            }`}
                          >
                            {ticket.id}
                          </span>
                          {isActioned && (
                            <span
                              className={`material-symbols-outlined text-[14px] ${
                                action.decision === "approved"
                                  ? "text-green-500"
                                  : action.decision === "rejected"
                                  ? "text-red-500"
                                  : "text-amber-500"
                              }`}
                            >
                              {action.decision === "approved"
                                ? "check_circle"
                                : action.decision === "rejected"
                                ? "cancel"
                                : "chat_bubble"}
                            </span>
                          )}
                        </div>
                        <p
                          className={`mt-0.5 truncate text-sm font-medium ${
                            isSelected ? "text-inverse-on-surface" : "text-on-surface"
                          }`}
                        >
                          {ticket.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {typeBadge(ticket.type)}
                          {urgencyBadge(ticket.urgency)}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`mt-2 flex items-center justify-between text-xs ${
                        isSelected ? "text-inverse-on-surface opacity-70" : "text-on-surface-variant"
                      }`}
                    >
                      <span>{ticket.sponsor}</span>
                      <span>{ticket.createdAgo}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* All-caught-up state overlay inside list area */}
          {allActioned && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/70">
              <span className="material-symbols-outlined text-[48px] text-green-500">check_circle</span>
              <p className="text-sm font-semibold text-green-700">All caught up!</p>
            </div>
          )}
        </aside>

        {/* ── Right panel — detail ─────────────────────────────────────────── */}
        <section className="flex min-w-0 flex-1 flex-col bg-surface-container-lowest">
          {selectedTicket ? (
            <>
              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto p-6 pb-2 space-y-5">
                {/* ── Ticket header ── */}
                <div>
                  <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono mb-1">
                    <span>{selectedTicket.product}</span>
                    <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                    <span>{selectedTicket.module}</span>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-mono font-semibold text-on-surface-variant">{selectedTicket.id}</p>
                      <h1 className="mt-1 text-xl font-bold text-on-surface leading-tight">
                        {selectedTicket.title}
                      </h1>
                    </div>
                    {currentAction && (
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                          currentAction.decision === "approved"
                            ? "bg-green-100 text-green-700"
                            : currentAction.decision === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {currentAction.decision === "approved"
                            ? "check_circle"
                            : currentAction.decision === "rejected"
                            ? "cancel"
                            : "chat_bubble"}
                        </span>
                        {currentAction.decision === "approved"
                          ? "Approved & Routed"
                          : currentAction.decision === "rejected"
                          ? "Won't Fix"
                          : "Clarification Sent"}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {typeBadge(selectedTicket.type)}
                    {urgencyBadge(selectedTicket.urgency)}
                  </div>

                  <p className="mt-3 text-sm text-on-surface leading-relaxed">
                    {selectedTicket.description}
                  </p>

                  <div className="mt-3 flex items-center gap-4 text-sm text-on-surface-variant">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">person</span>
                      {selectedTicket.sponsor}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">schedule</span>
                      Submitted {selectedTicket.createdAgo}
                    </span>
                  </div>
                </div>

                {/* ── AI Recommendation card ── */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] text-amber-600">auto_awesome</span>
                      <span className="font-semibold text-amber-900">AI Recommendation</span>
                    </div>
                    {confidenceBadge(selectedTicket.ai.confidence)}
                  </div>

                  <div className="space-y-4">
                    {/* Priority */}
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 items-center gap-1.5 w-36">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">flag</span>
                        <span className="text-xs font-medium text-amber-800">Priority Tier</span>
                      </div>
                      <div>
                        <div className="mb-1">{priorityBadge(selectedTicket.ai.priority)}</div>
                        <p className="text-xs italic text-amber-700">{selectedTicket.ai.priorityRationale}</p>
                      </div>
                    </div>

                    {/* Category */}
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 items-center gap-1.5 w-36">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">category</span>
                        <span className="text-xs font-medium text-amber-800">Category</span>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-amber-900">{selectedTicket.ai.category}</p>
                        <p className="text-xs italic text-amber-700">{selectedTicket.ai.categoryRationale}</p>
                      </div>
                    </div>

                    {/* Assignee */}
                    <div className="flex items-start gap-3">
                      <div className="flex shrink-0 items-center gap-1.5 w-36">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">person_pin</span>
                        <span className="text-xs font-medium text-amber-800">Suggested Assignee</span>
                      </div>
                      <div>
                        <p className="mb-1 text-sm font-semibold text-amber-900">{selectedTicket.ai.assignee}</p>
                        <p className="text-xs italic text-amber-700">{selectedTicket.ai.assigneeRationale}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── PM Override section ── */}
                <div className="rounded-2xl border border-outline-variant bg-white p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-on-surface">PM Override</span>
                    {/* Toggle */}
                    <label className="flex cursor-pointer items-center gap-2 select-none">
                      <span className="text-xs text-on-surface-variant">Use AI recommendation</span>
                      <button
                        role="switch"
                        aria-checked={useAiRec}
                        onClick={() => setUseAiRec((v) => !v)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          useAiRec ? "bg-primary" : "bg-outline-variant"
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            useAiRec ? "translate-x-4" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </label>
                  </div>

                  {!useAiRec && (
                    <div className="grid grid-cols-3 gap-3">
                      {/* Priority select */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-on-surface-variant">Priority</label>
                        <select
                          value={overridePriority}
                          onChange={(e) => setOverridePriority(e.target.value as Priority)}
                          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {PRIORITIES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      {/* Category select */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-on-surface-variant">Category</label>
                        <select
                          value={overrideCategory}
                          onChange={(e) => setOverrideCategory(e.target.value as Category)}
                          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      {/* Assignee select */}
                      <div>
                        <label className="mb-1 block text-xs font-medium text-on-surface-variant">Assignee</label>
                        <select
                          value={overrideAssignee}
                          onChange={(e) => setOverrideAssignee(e.target.value)}
                          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          {TEAM_MEMBERS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* PM Notes */}
                  <div>
                    <label className="mb-1 block text-xs font-medium text-on-surface-variant">
                      PM Notes <span className="font-normal opacity-60">(optional)</span>
                    </label>
                    <textarea
                      value={pmNotes}
                      onChange={(e) => setPmNotes(e.target.value)}
                      placeholder="Add reasoning or context for the team…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              {/* ── Action buttons — sticky bottom ── */}
              <div className="shrink-0 border-t border-outline-variant bg-surface-container-lowest px-6 py-4">
                <div className="flex items-center gap-3">
                  {/* Reject */}
                  <button
                    onClick={handleReject}
                    className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 active:bg-red-100"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    Reject (Won't Fix)
                  </button>

                  {/* Clarification */}
                  <button
                    onClick={handleClarification}
                    className="flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container active:bg-outline-variant/20"
                  >
                    <span className="material-symbols-outlined text-[16px]">chat_bubble</span>
                    Ask for Clarification
                  </button>

                  <div className="flex-1" />

                  {/* Approve */}
                  <button
                    onClick={handleApprove}
                    className="flex items-center gap-2 rounded-full bg-on-surface px-6 py-2.5 text-sm font-semibold text-surface shadow-sm transition-colors hover:opacity-90 active:opacity-80"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Approve &amp; Route
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-on-surface-variant">
              <span className="material-symbols-outlined text-[48px] opacity-30">inbox</span>
              <p className="text-sm opacity-50">Select a ticket from the inbox</p>
            </div>
          )}
        </section>
      </div>

      {/* ── Toast stack ─────────────────────────────────────────────────────── */}
      <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex items-center gap-2 rounded-2xl bg-on-surface px-4 py-3 text-sm font-medium text-surface shadow-lg"
            style={{ animation: "slideInRight 0.2s ease-out" }}
          >
            <span className="material-symbols-outlined text-[18px]">{toast.icon}</span>
            {toast.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
