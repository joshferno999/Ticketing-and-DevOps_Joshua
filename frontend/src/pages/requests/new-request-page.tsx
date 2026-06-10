/**
 * BuildTrack — New Request Form
 * Single-page form: all fields visible at once, one Submit at the bottom.
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
    Dashboard: [],
    Pipeline: [],
    "Deal Details": ["Overview", "Financials", "Diligence Tasks", "Collaboration", "Documentation"],
  },
  SCT: {
    Dashboard: [],
    "Sourcing Lead Pipeline": [],
    "Sequence Management": [],
    "Email Deliverability Dashboard": [],
    "Reply Dashboard": [],
  },
  "Hiring Tool": {
    "Ops Tool": [],
    "Screening & Feedback": [],
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

interface FormState {
  title: string;
  description: string;
  files: File[];
  requestType: RequestType | null;
  product: string;
  module: string;
  submodule: string;
  urgency: Urgency | null;
  pageUrl: string;
}

const INITIAL_STATE: FormState = {
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

// ─── Constants ────────────────────────────────────────────────────────────────

const REQUEST_TYPES: {
  value: RequestType;
  emoji: string;
  label: string;
  description: string;
  note?: string;
}[] = [
  { value: "bug", emoji: "🐛", label: "Bug", description: "Something is broken or not working as expected" },
  { value: "enhancement", emoji: "✨", label: "Enhancement", description: "Improve an existing feature or workflow" },
  { value: "new_feature", emoji: "🆕", label: "New Feature", description: "A brand new capability or screen" },
  { value: "data_reporting", emoji: "📊", label: "Data / Reporting", description: "A new report, export, or data view" },
  { value: "process_change", emoji: "🔄", label: "Process Change", description: "A change to how a workflow or process works" },
  {
    value: "sponsor_build",
    emoji: "🏗️",
    label: "Sponsor Build",
    description: "A full feature built by the engineering team for your vertical",
    note: "A more detailed form will follow after submission",
  },
];

const URGENCY_OPTIONS: {
  value: Urgency;
  dot: string;
  label: string;
  description: string;
}[] = [
  { value: "critical", dot: "🔴", label: "Critical", description: "Blocking work right now" },
  { value: "high", dot: "🟠", label: "High", description: "Significantly impacting productivity" },
  { value: "medium", dot: "🟡", label: "Medium", description: "Has a workaround, schedule when possible" },
  { value: "low", dot: "🟢", label: "Low", description: "Nice to have, no urgency" },
];

const TYPE_LABEL_MAP: Record<RequestType, string> = {
  bug: "Bug",
  enhancement: "Enhancement",
  new_feature: "New Feature",
  data_reporting: "Data / Reporting",
  process_change: "Process Change",
  sponsor_build: "Sponsor Build",
};

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  number,
  title,
  subtitle,
}: {
  number: number;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary font-semibold text-sm mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-label-md text-label-md text-on-surface">{title}</p>
        {subtitle && (
          <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

// ─── Success card ─────────────────────────────────────────────────────────────

function SuccessCard({ state }: { state: FormState }) {
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

      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-5 py-3">
        <span className="material-symbols-outlined text-green-600" style={{ fontSize: 20, fontVariationSettings: "'FILL' 1" }}>
          confirmation_number
        </span>
        <span className="font-mono text-sm font-semibold text-green-800">REQ-004</span>
      </div>

      <div className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-5 text-left flex flex-col gap-2.5">
        <p className="font-label-md text-label-md text-on-surface mb-1">Summary</p>
        {[
          { label: "Title", value: state.title },
          { label: "Type", value: state.requestType ? TYPE_LABEL_MAP[state.requestType] : "—" },
          {
            label: "Module",
            value: [state.product, state.module, state.submodule].filter(Boolean).join(" › "),
          },
          { label: "Urgency", value: state.urgency ? state.urgency.charAt(0).toUpperCase() + state.urgency.slice(1) : "—" },
          ...(state.files.length > 0
            ? [{ label: "Attachments", value: `${state.files.length} file${state.files.length !== 1 ? "s" : ""}` }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex gap-3">
            <span className="w-24 shrink-0 font-label-sm text-label-sm text-on-surface-variant">{label}</span>
            <span className="font-body-md text-body-md text-on-surface">{value}</span>
          </div>
        ))}
      </div>

      <Link
        to="/sponsor"
        className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
        Back to My Requests
      </Link>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function NewRequestPage() {
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [state, setState] = useState<FormState>(INITIAL_STATE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patch(update: Partial<FormState>) {
    setState((prev) => ({ ...prev, ...update }));
    // Clear related errors on change
    const keys = Object.keys(update) as (keyof FormState)[];
    if (keys.some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  }

  function handleProductChange(product: string) {
    patch({ product, module: "", submodule: "" });
  }

  function handleModuleChange(module: string) {
    patch({ module, submodule: "" });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    patch({ files: [...state.files, ...Array.from(e.target.files)] });
    e.target.value = "";
  }

  function removeFile(idx: number) {
    patch({ files: state.files.filter((_, i) => i !== idx) });
  }

  function validate(): boolean {
    const next: typeof errors = {};
    if (!state.title.trim()) next.title = "Title is required";
    if (!state.description.trim()) next.description = "Description is required";
    if (!state.requestType) next.requestType = "Please select a request type";
    if (!state.product) next.product = "Please select a product";
    if (!state.module) next.module = "Please select a module";
    if (!state.urgency) next.urgency = "Please select an urgency level";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit() {
    if (validate()) setSubmitted(true);
  }

  const modules = state.product ? Object.keys(MODULE_TREE[state.product] ?? {}) : [];
  const submodules = state.product && state.module ? MODULE_TREE[state.product]?.[state.module] ?? [] : [];

  return (
    <div className="flex min-h-full items-start justify-center bg-background-alt px-4 py-10">
      {/* Not connected banner */}
      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-body-sm text-body-sm text-amber-800">
          <span className="material-symbols-outlined shrink-0 text-amber-600" style={{ fontSize: 16 }}>
            warning
          </span>
          Not connected to API — form state is local only
        </div>

        <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
          {submitted ? (
            <SuccessCard state={state} />
          ) : (
            <>
              {/* Header */}
              <div className="mb-8 text-center">
                <h1 className="font-headline-sm text-headline-sm text-on-surface">New Request</h1>
                <p className="mt-1 font-body-md text-body-md text-on-surface-variant">
                  Fill in the details below and submit — we'll review and get back to you.
                </p>
              </div>

              <div className="flex flex-col gap-8">

                {/* ── Section 1: What ────────────────────────────────────────── */}
                <section>
                  <SectionHeader number={1} title="What's the request?" />
                  <div className="flex flex-col gap-4 pl-10">
                    {/* Title */}
                    <div>
                      <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={state.title}
                        onChange={(e) => patch({ title: e.target.value })}
                        placeholder="Brief title of your request"
                        className={`w-full rounded-xl border bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors ${
                          errors.title ? "border-red-400 focus:border-red-400" : "border-outline-variant focus:border-primary"
                        }`}
                      />
                      {errors.title && (
                        <p className="mt-1 font-body-sm text-body-sm text-red-500">{errors.title}</p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        rows={5}
                        value={state.description}
                        onChange={(e) => patch({ description: e.target.value })}
                        placeholder="Describe what's happening or what you need. The more detail the better — include steps to reproduce for bugs, or outcomes you're hoping for on new requests."
                        className={`w-full resize-none rounded-xl border bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors ${
                          errors.description ? "border-red-400 focus:border-red-400" : "border-outline-variant focus:border-primary"
                        }`}
                      />
                      {errors.description && (
                        <p className="mt-1 font-body-sm text-body-sm text-red-500">{errors.description}</p>
                      )}
                    </div>

                    {/* Attachments */}
                    <div>
                      <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                        Attachments <span className="text-on-surface-variant opacity-60">(optional)</span>
                      </label>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-outline-variant bg-surface-container-lowest px-6 py-6 text-center transition-colors hover:border-outline hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-[32px] text-on-surface-variant opacity-40">
                          cloud_upload
                        </span>
                        <p className="font-body-sm text-body-sm text-on-surface-variant">
                          Drop files here or{" "}
                          <span className="text-primary underline">click to upload</span>
                        </p>
                        <p className="font-body-sm text-body-sm text-on-surface-variant opacity-50">
                          Screenshots, mockups, documents
                        </p>
                      </div>
                      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
                      {state.files.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {state.files.map((file, idx) => (
                            <li
                              key={idx}
                              className="flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2"
                            >
                              <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 15 }}>
                                description
                              </span>
                              <span className="flex-1 truncate font-body-sm text-body-sm text-on-surface">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="text-on-surface-variant hover:text-on-surface transition-colors"
                                aria-label="Remove file"
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 15 }}>close</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>

                <div className="h-px bg-outline-variant" />

                {/* ── Section 2: Type ────────────────────────────────────────── */}
                <section>
                  <SectionHeader
                    number={2}
                    title="What type of request is this?"
                    subtitle="Pick the category that best describes what you need"
                  />
                  <div className="pl-10">
                    {errors.requestType && (
                      <p className="mb-2 font-body-sm text-body-sm text-red-500">{errors.requestType}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {REQUEST_TYPES.map((rt) => {
                        const isSelected = state.requestType === rt.value;
                        return (
                          <button
                            key={rt.value}
                            type="button"
                            onClick={() => patch({ requestType: rt.value })}
                            className={`flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors ${
                              isSelected
                                ? "border-inverse-surface bg-inverse-surface/8"
                                : "border-outline-variant hover:border-outline hover:bg-surface-container-low"
                            }`}
                          >
                            <span className="text-xl">{rt.emoji}</span>
                            <span className="font-label-sm text-label-sm text-on-surface leading-snug">{rt.label}</span>
                            <span className="font-body-sm text-body-sm text-on-surface-variant leading-snug opacity-80">
                              {rt.description}
                            </span>
                            {rt.note && (
                              <span className="mt-0.5 font-body-sm text-body-sm text-violet-600 leading-snug italic">
                                {rt.note}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <div className="h-px bg-outline-variant" />

                {/* ── Section 3: Module ──────────────────────────────────────── */}
                <section>
                  <SectionHeader
                    number={3}
                    title="Which part of the product?"
                    subtitle="Helps us route this to the right team"
                  />
                  <div className="flex flex-col gap-3 pl-10">
                    {/* Product */}
                    <div>
                      <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={state.product}
                        onChange={(e) => handleProductChange(e.target.value)}
                        className={`w-full rounded-xl border bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors ${
                          errors.product ? "border-red-400" : "border-outline-variant focus:border-primary"
                        }`}
                      >
                        <option value="">Select a product…</option>
                        {Object.keys(MODULE_TREE).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      {errors.product && (
                        <p className="mt-1 font-body-sm text-body-sm text-red-500">{errors.product}</p>
                      )}
                    </div>

                    {/* Module — shown after product selected */}
                    {state.product && (
                      <div>
                        <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                          Module <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={state.module}
                          onChange={(e) => handleModuleChange(e.target.value)}
                          className={`w-full rounded-xl border bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors ${
                            errors.module ? "border-red-400" : "border-outline-variant focus:border-primary"
                          }`}
                        >
                          <option value="">Select a module…</option>
                          {modules.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        {errors.module && (
                          <p className="mt-1 font-body-sm text-body-sm text-red-500">{errors.module}</p>
                        )}
                      </div>
                    )}

                    {/* Submodule — shown if module has submodules */}
                    {state.module && submodules.length > 0 && (
                      <div>
                        <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                          Submodule <span className="text-on-surface-variant opacity-60">(optional)</span>
                        </label>
                        <select
                          value={state.submodule}
                          onChange={(e) => patch({ submodule: e.target.value })}
                          className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors"
                        >
                          <option value="">None — module level is fine</option>
                          {submodules.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Breadcrumb preview */}
                    {state.product && state.module && (
                      <div className="flex items-center gap-1.5 rounded-xl border border-outline-variant bg-surface-container-low px-4 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>account_tree</span>
                        <span>{[state.product, state.module, state.submodule].filter(Boolean).join(" › ")}</span>
                      </div>
                    )}
                  </div>
                </section>

                <div className="h-px bg-outline-variant" />

                {/* ── Section 4: Priority ────────────────────────────────────── */}
                <section>
                  <SectionHeader
                    number={4}
                    title="How urgent is this?"
                    subtitle="Be honest — it helps us triage fairly"
                  />
                  <div className="flex flex-col gap-4 pl-10">
                    {errors.urgency && (
                      <p className="font-body-sm text-body-sm text-red-500">{errors.urgency}</p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {URGENCY_OPTIONS.map((opt) => {
                        const isSelected = state.urgency === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => patch({ urgency: opt.value })}
                            className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                              isSelected
                                ? "border-inverse-surface bg-inverse-surface/8"
                                : "border-outline-variant hover:border-outline hover:bg-surface-container-low"
                            }`}
                          >
                            <span className="mt-0.5 text-lg">{opt.dot}</span>
                            <div>
                              <p className="font-label-sm text-label-sm text-on-surface">{opt.label}</p>
                              <p className="mt-0.5 font-body-sm text-body-sm text-on-surface-variant leading-snug">
                                {opt.description}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Page URL */}
                    <div>
                      <label className="mb-1.5 block font-label-sm text-label-sm text-on-surface-variant">
                        Page URL <span className="text-on-surface-variant opacity-60">(optional)</span>
                      </label>
                      <input
                        type="url"
                        value={state.pageUrl}
                        onChange={(e) => patch({ pageUrl: e.target.value })}
                        placeholder="https://…"
                        className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-stack-sm font-body-md text-body-md text-on-surface placeholder:text-on-surface-variant focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] transition-colors"
                      />
                      <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant opacity-70">
                        Link to the page where the issue occurs or the feature should live
                      </p>
                    </div>
                  </div>
                </section>

                {/* ── Submit ─────────────────────────────────────────────────── */}
                <div className="flex items-center justify-between border-t border-outline-variant pt-6">
                  <Link
                    to="/sponsor"
                    className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
                    Cancel
                  </Link>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary hover:bg-inverse-surface transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: "'FILL' 1" }}>
                      send
                    </span>
                    Submit Request
                  </button>
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
