/**
 * BuildTrack — New Request Intake Wizard
 * 4-step flow: What → Type → Module → Priority
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";

// ─── Module tree ──────────────────────────────────────────────────────────────

interface ModuleTree {
  [product: string]: {
    [module: string]: string[];
  };
}

const MODULE_TREE: ModuleTree = {
  DCC: {
    Dashboard: ["Overview", "KPIs", "Charts"],
    Pipeline: ["Deal List", "Kanban", "Forecast"],
    Contacts: ["People", "Companies", "Merge"],
    Activities: ["Tasks", "Meetings", "Calls"],
    Reporting: ["Standard Reports", "Custom Builder", "Scheduled"],
    Settings: ["Fields", "Stages", "Integrations"],
  },
  SCT: {
    Dashboard: ["Summary", "Deal Tracker"],
    Contracts: ["Active", "Expired", "Templates"],
    Amendments: ["Pending", "History"],
    Compliance: ["Checklists", "Audit Log"],
    Reporting: ["Volume", "Renewals", "Exceptions"],
  },
  "Hiring Tool": {
    Requisitions: ["Open", "Approved", "Drafts"],
    Candidates: ["Active", "Pipeline", "Archive"],
    Interviews: ["Scheduled", "Feedback", "Scoring"],
    Offers: ["Pending", "Accepted", "Declined"],
    Reporting: ["Headcount", "Time to Fill", "Source"],
  },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type RequestType =
  | "bug"
  | "enhancement"
  | "new_feature"
  | "data_reporting"
  | "process_change"
  | "sponsor_build";

type Urgency = "critical" | "high" | "medium" | "low";

interface WizardState {
  // Step 1
  title: string;
  description: string;
  files: File[];
  // Step 2
  requestType: RequestType | null;
  // Step 3
  product: string;
  module: string;
  submodule: string;
  // Step 4
  urgency: Urgency | null;
  pageUrl: string;
}

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["What", "Type", "Module", "Priority"];

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, idx) => {
        const stepNum = idx + 1;
        const isCompleted = stepNum < currentStep;
        const isActive = stepNum === currentStep;
        const isFuture = stepNum > currentStep;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full font-label-md text-label-md transition-all ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isActive
                    ? "bg-primary-container text-on-primary ring-4 ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                    : "border-2 border-outline-variant bg-surface-container-lowest text-on-surface-variant"
                }`}
              >
                {isCompleted ? (
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}
                  >
                    check
                  </span>
                ) : (
                  <span className="text-sm font-semibold">{stepNum}</span>
                )}
              </div>
              <span
                className={`font-label-sm text-label-sm whitespace-nowrap ${
                  isActive
                    ? "text-on-surface font-semibold"
                    : isFuture
                    ? "text-on-surface-variant"
                    : "text-on-surface-variant"
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                className={`mx-2 mb-5 h-0.5 w-12 rounded-full transition-colors ${
                  stepNum < currentStep ? "bg-green-400" : "bg-outline-variant"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — What ───────────────────────────────────────────────────────────

function StepWhat({
  state,
  onChange,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onNext: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const incoming = Array.from(e.target.files);
    onChange({ files: [...state.files, ...incoming] });
    // Reset input so the same file can be re-added if removed
    e.target.value = "";
  }

  function removeFile(idx: number) {
    onChange({ files: state.files.filter((_, i) => i !== idx) });
  }

  const canProceed = state.title.trim().length > 0 && state.description.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Brief title of your request"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
        />
      </div>

      <div>
        <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
          Description <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={5}
          value={state.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe what's happening or what you need…"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] resize-none"
        />
      </div>

      {/* File upload */}
      <div>
        <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
          Attachments <span className="font-body-sm text-body-sm text-on-surface-variant">(optional)</span>
        </label>
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest px-6 py-8 text-center transition-colors hover:border-outline hover:bg-surface-container-low"
        >
          <span className="material-symbols-outlined text-[36px] text-on-surface-variant opacity-50">
            cloud_upload
          </span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Drop files here or <span className="text-primary underline">click to upload</span>
          </p>
          <p className="font-body-sm text-body-sm text-on-surface-variant opacity-60">
            Screenshots, mockups, documents
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        {state.files.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5">
            {state.files.map((file, idx) => (
              <li
                key={idx}
                className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
              >
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 16 }}>
                  description
                </span>
                <span className="flex-1 truncate font-body-sm text-body-sm text-on-surface">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(idx)}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label="Remove file"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                    close
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          Next
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Step 2 — Type ────────────────────────────────────────────────────────────

const REQUEST_TYPES: {
  value: RequestType;
  emoji: string;
  label: string;
  description: string;
  note?: string;
}[] = [
  { value: "bug", emoji: "🐛", label: "Bug", description: "Something is broken or not working as expected" },
  {
    value: "enhancement",
    emoji: "✨",
    label: "Enhancement",
    description: "Improve an existing feature or workflow",
  },
  {
    value: "new_feature",
    emoji: "🆕",
    label: "New Feature",
    description: "A brand new capability or screen",
  },
  {
    value: "data_reporting",
    emoji: "📊",
    label: "Data / Reporting",
    description: "A new report, export, or data view",
  },
  {
    value: "process_change",
    emoji: "🔄",
    label: "Process Change",
    description: "A change to how a workflow or process works",
  },
  {
    value: "sponsor_build",
    emoji: "🏗️",
    label: "Sponsor Build",
    description: "A full feature built by the engineering team for your vertical",
    note: "This will open a more detailed form after submission",
  },
];

function StepType({
  state,
  onChange,
  onBack,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        {REQUEST_TYPES.map((rt) => {
          const isSelected = state.requestType === rt.value;
          return (
            <button
              key={rt.value}
              onClick={() => onChange({ requestType: rt.value })}
              className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors ${
                isSelected
                  ? "border-inverse-surface bg-inverse-surface/8"
                  : "border-outline-variant hover:border-outline hover:bg-surface-container-low"
              }`}
            >
              <span className="text-2xl">{rt.emoji}</span>
              <span className="font-label-md text-label-md text-on-surface">{rt.label}</span>
              <span className="font-body-sm text-body-sm text-on-surface-variant leading-snug">
                {rt.description}
              </span>
              {rt.note && (
                <span className="mt-1 font-body-sm text-body-sm text-violet-600 leading-snug italic">
                  {rt.note}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!state.requestType}
          className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          Next
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Step 3 — Module ──────────────────────────────────────────────────────────

function StepModule({
  state,
  onChange,
  onBack,
  onNext,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const products = Object.keys(MODULE_TREE);
  const modules = state.product ? Object.keys(MODULE_TREE[state.product] ?? {}) : [];
  const submodules =
    state.product && state.module ? MODULE_TREE[state.product]?.[state.module] ?? [] : [];

  const canProceed = state.product.length > 0 && state.module.length > 0;

  function handleProductChange(product: string) {
    onChange({ product, module: "", submodule: "" });
  }

  function handleModuleChange(module: string) {
    onChange({ module, submodule: "" });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="font-body-md text-body-md text-on-surface-variant">
        Which part of the product does this relate to?
      </p>

      {/* Product */}
      <div>
        <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
          Product <span className="text-red-500">*</span>
        </label>
        <select
          value={state.product}
          onChange={(e) => handleProductChange(e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
        >
          <option value="">Select a product…</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {/* Module — appears after product chosen */}
      {state.product && (
        <div>
          <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
            Module <span className="text-red-500">*</span>
          </label>
          <select
            value={state.module}
            onChange={(e) => handleModuleChange(e.target.value)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
          >
            <option value="">Select a module…</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Submodule — appears if module has submodules */}
      {state.module && submodules.length > 0 && (
        <div>
          <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
            Submodule{" "}
            <span className="font-body-sm text-body-sm text-on-surface-variant">(optional)</span>
          </label>
          <select
            value={state.submodule}
            onChange={(e) => onChange({ submodule: e.target.value })}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
          >
            <option value="">None — module level is fine</option>
            {submodules.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Breadcrumb preview */}
      {state.product && state.module && (
        <div className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 font-body-sm text-body-sm text-on-surface-variant">
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            account_tree
          </span>
          <span>
            {state.product} › {state.module}
            {state.submodule ? ` › ${state.submodule}` : ""}
          </span>
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          Next
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_forward
          </span>
        </button>
      </div>
    </div>
  );
}

// ─── Step 4 — Priority ────────────────────────────────────────────────────────

const URGENCY_OPTIONS: {
  value: Urgency;
  dot: string;
  label: string;
  description: string;
}[] = [
  {
    value: "critical",
    dot: "🔴",
    label: "Critical",
    description: "Blocking work right now. Needs immediate attention.",
  },
  {
    value: "high",
    dot: "🟠",
    label: "High",
    description: "Significantly impacting productivity. Needs fixing soon.",
  },
  {
    value: "medium",
    dot: "🟡",
    label: "Medium",
    description: "Annoying but has a workaround. Schedule when possible.",
  },
  {
    value: "low",
    dot: "🟢",
    label: "Low",
    description: "Nice to have. No urgency.",
  },
];

const TYPE_LABEL_MAP: Record<RequestType, string> = {
  bug: "Bug",
  enhancement: "Enhancement",
  new_feature: "New Feature",
  data_reporting: "Data / Reporting",
  process_change: "Process Change",
  sponsor_build: "Sponsor Build",
};

function StepPriority({
  state,
  onChange,
  onBack,
  onSubmit,
}: {
  state: WizardState;
  onChange: (patch: Partial<WizardState>) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Urgency cards */}
      <div>
        <label className="mb-2 block font-label-md text-label-md text-on-surface">
          Urgency <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {URGENCY_OPTIONS.map((opt) => {
            const isSelected = state.urgency === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange({ urgency: opt.value })}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? "border-inverse-surface bg-inverse-surface/8"
                    : "border-outline-variant hover:border-outline hover:bg-surface-container-low"
                }`}
              >
                <span className="mt-0.5 text-xl">{opt.dot}</span>
                <div>
                  <p className="font-label-md text-label-md text-on-surface">{opt.label}</p>
                  <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant leading-snug">
                    {opt.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Page URL */}
      <div>
        <label className="mb-1.5 block font-label-md text-label-md text-on-surface">
          Page URL{" "}
          <span className="font-body-sm text-body-sm text-on-surface-variant">(optional)</span>
        </label>
        <input
          type="url"
          value={state.pageUrl}
          onChange={(e) => onChange({ pageUrl: e.target.value })}
          placeholder="https://…"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
        />
        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
          Link to the page where the issue occurs or the feature should live
        </p>
      </div>

      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onBack}
          className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            arrow_back
          </span>
          Back
        </button>
        <button
          onClick={onSubmit}
          disabled={!state.urgency}
          className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            send
          </span>
          Submit Request
        </button>
      </div>
    </div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function SuccessCard({ state }: { state: WizardState }) {
  return (
    <div className="flex flex-col items-center gap-6 py-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl">
        🎉
      </div>
      <div>
        <h2 className="font-label-lg text-label-lg text-on-surface">Request submitted!</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
          We received your request and will review it shortly.
        </p>
      </div>

      {/* Mock ID */}
      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
        <span className="material-symbols-outlined text-green-600" style={{ fontSize: 20 }}>
          confirmation_number
        </span>
        <span className="font-mono text-sm font-semibold text-green-800">REQ-004</span>
      </div>

      {/* Summary */}
      <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-left flex flex-col gap-3">
        <h3 className="font-label-md text-label-md text-on-surface">Summary</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-3">
            <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">Title</span>
            <span className="font-body-md text-body-md text-on-surface">{state.title}</span>
          </div>
          <div className="flex gap-3">
            <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">Type</span>
            <span className="font-body-md text-body-md text-on-surface">
              {state.requestType ? TYPE_LABEL_MAP[state.requestType] : "—"}
            </span>
          </div>
          <div className="flex gap-3">
            <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">Module</span>
            <span className="font-body-md text-body-md text-on-surface">
              {state.product} › {state.module}
              {state.submodule ? ` › ${state.submodule}` : ""}
            </span>
          </div>
          <div className="flex gap-3">
            <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">Urgency</span>
            <span className="font-body-md text-body-md text-on-surface capitalize">{state.urgency}</span>
          </div>
          {state.files.length > 0 && (
            <div className="flex gap-3">
              <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">
                Attachments
              </span>
              <span className="font-body-md text-body-md text-on-surface">
                {state.files.length} file{state.files.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </div>
      </div>

      <Link
        to="/sponsor"
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
          arrow_back
        </span>
        Back to My Requests
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const INITIAL_STATE: WizardState = {
  title: "",
  description: "",
  files: [],
  requestType: null,
  product: "",
  module: "",
  submodule: "",
  urgency: null,
  pageUrl: "",
};

export function NewRequestPage() {
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);

  function patch(update: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...update }));
  }

  function handleSubmit() {
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-full items-start justify-center bg-background-alt px-4 py-10">
      <div className="w-full max-w-2xl rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        {/* Page title */}
        {!submitted && (
          <div className="mb-6 text-center">
            <h1 className="font-label-lg text-label-lg text-on-surface">New Request</h1>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
              Tell us what you need in a few quick steps
            </p>
          </div>
        )}

        {/* Step indicator */}
        {!submitted && <StepIndicator currentStep={step} />}

        {/* Step content */}
        {submitted ? (
          <SuccessCard state={state} />
        ) : step === 1 ? (
          <StepWhat state={state} onChange={patch} onNext={() => setStep(2)} />
        ) : step === 2 ? (
          <StepType
            state={state}
            onChange={patch}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        ) : step === 3 ? (
          <StepModule
            state={state}
            onChange={patch}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        ) : (
          <StepPriority
            state={state}
            onChange={patch}
            onBack={() => setStep(3)}
            onSubmit={handleSubmit}
          />
        )}
      </div>
    </div>
  );
}
