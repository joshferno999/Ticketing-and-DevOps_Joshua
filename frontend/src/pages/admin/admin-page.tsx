/**
 * BuildTrack Admin Panel
 * Sections: Modules, Users, SLA, Routing, Themes, Templates
 * All state is local — no API calls in Phase 1.
 */
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type AdminSection = "modules" | "users" | "sla" | "routing" | "themes" | "templates";

const SECTION_LABELS: Record<AdminSection, string> = {
  modules: "Modules",
  users: "Users",
  sla: "SLA Policies",
  routing: "Routing",
  themes: "Themes",
  templates: "Templates",
};

const SECTION_ICONS: Record<AdminSection, string> = {
  modules: "account_tree",
  users: "group",
  sla: "timer",
  routing: "alt_route",
  themes: "label",
  templates: "description",
};

// ── Modules ──────────────────────────────────

type ModuleLevel = "product" | "module" | "submodule";

interface ModuleNode {
  id: string;
  name: string;
  level: ModuleLevel;
  sortOrder: number;
  parentId: string | null;
  archived: boolean;
}

const INITIAL_MODULES: ModuleNode[] = [
  // DCC product
  { id: "p1", name: "DCC", level: "product", sortOrder: 1, parentId: null, archived: false },
  { id: "p1m1", name: "Dashboard", level: "module", sortOrder: 1, parentId: "p1", archived: false },
  { id: "p1m2", name: "Pipeline", level: "module", sortOrder: 2, parentId: "p1", archived: false },
  { id: "p1m3", name: "Deal Details", level: "module", sortOrder: 3, parentId: "p1", archived: false },
  { id: "p1m3s1", name: "Overview", level: "submodule", sortOrder: 1, parentId: "p1m3", archived: false },
  { id: "p1m3s2", name: "Financials", level: "submodule", sortOrder: 2, parentId: "p1m3", archived: false },
  { id: "p1m3s3", name: "Diligence Tasks", level: "submodule", sortOrder: 3, parentId: "p1m3", archived: false },
  { id: "p1m3s4", name: "Collaboration", level: "submodule", sortOrder: 4, parentId: "p1m3", archived: false },
  { id: "p1m3s5", name: "Documentation", level: "submodule", sortOrder: 5, parentId: "p1m3", archived: false },
  // SCT product
  { id: "p2", name: "SCT", level: "product", sortOrder: 2, parentId: null, archived: false },
  { id: "p2m1", name: "Dashboard", level: "module", sortOrder: 1, parentId: "p2", archived: false },
  { id: "p2m2", name: "Sourcing Lead Pipeline", level: "module", sortOrder: 2, parentId: "p2", archived: false },
  { id: "p2m3", name: "Sequence Management", level: "module", sortOrder: 3, parentId: "p2", archived: false },
  { id: "p2m4", name: "Email Deliverability Dashboard", level: "module", sortOrder: 4, parentId: "p2", archived: false },
  { id: "p2m5", name: "Reply Dashboard", level: "module", sortOrder: 5, parentId: "p2", archived: false },
  // Hiring Tool product
  { id: "p3", name: "Hiring Tool", level: "product", sortOrder: 3, parentId: null, archived: false },
  { id: "p3m1", name: "Ops Tool", level: "module", sortOrder: 1, parentId: "p3", archived: false },
  { id: "p3m2", name: "Screening & Feedback", level: "module", sortOrder: 2, parentId: "p3", archived: false },
];

// ── Users ─────────────────────────────────────

type UserRole = "sponsor" | "pm" | "dev" | "sr_engineer" | "admin";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

const INITIAL_USERS: UserRow[] = [
  { id: "u1", name: "Joshua Fernando", email: "joshua@emsoft.com", role: "admin", active: true },
  { id: "u2", name: "Rishabh", email: "rishabh@emsoft.com", role: "pm", active: true },
  { id: "u3", name: "Hari", email: "hari@emsoft.com", role: "sr_engineer", active: true },
];

const ROLE_BADGE: Record<UserRole, string> = {
  sponsor: "border-blue-300 bg-blue-100 text-blue-800",
  pm: "border-purple-300 bg-purple-100 text-purple-800",
  dev: "border-teal-300 bg-teal-100 text-teal-800",
  sr_engineer: "border-orange-300 bg-orange-100 text-orange-800",
  admin: "border-red-300 bg-red-100 text-red-800",
};

const ROLE_LABELS: Record<UserRole, string> = {
  sponsor: "Sponsor",
  pm: "PM",
  dev: "Dev",
  sr_engineer: "Sr Engineer",
  admin: "Admin",
};

// ── SLA ───────────────────────────────────────

type BreachAction = "slack_immediate" | "daily_digest_flag" | "weekly_digest_flag";

interface SlaRow {
  priority: string;
  triageHours: number;
  resolutionHours: number | null;
  breachAction: BreachAction;
}

const INITIAL_SLA: SlaRow[] = [
  { priority: "P0", triageHours: 4, resolutionHours: 24, breachAction: "slack_immediate" },
  { priority: "P1", triageHours: 24, resolutionHours: 72, breachAction: "slack_immediate" },
  { priority: "P2", triageHours: 72, resolutionHours: 336, breachAction: "daily_digest_flag" },
  { priority: "P3", triageHours: 168, resolutionHours: null, breachAction: "weekly_digest_flag" },
];

// ── Routing ───────────────────────────────────

interface PmRule {
  id: string;
  module: string;
  pm: string;
}

interface AutoRule {
  id: string;
  conditionField: string;
  conditionValue: string;
  actionType: string;
  actionValue: string;
  autoApply: boolean;
}

// ── Templates ─────────────────────────────────

interface TemplateRow {
  id: string;
  name: string;
  triggerType: string;
  refinedTask: string;
  effortEstimate: string;
  category: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function resolveSection(input: string | null): AdminSection {
  if (
    input === "modules" || input === "users" || input === "sla" ||
    input === "routing" || input === "themes" || input === "templates"
  ) {
    return input;
  }
  return "modules";
}

// ─────────────────────────────────────────────
// Sub-section: Modules
// ─────────────────────────────────────────────

const LEVEL_BADGE: Record<ModuleLevel, string> = {
  product: "border-violet-300 bg-violet-100 text-violet-800",
  module: "border-sky-300 bg-sky-100 text-sky-800",
  submodule: "border-emerald-300 bg-emerald-100 text-emerald-800",
};

const LEVEL_INDENT: Record<ModuleLevel, string> = {
  product: "",
  module: "pl-6",
  submodule: "pl-12",
};

interface InlineNodeForm {
  parentId: string | null;
  level: ModuleLevel;
  name: string;
  sortOrder: string;
}

function ModulesSection() {
  const [nodes, setNodes] = useState<ModuleNode[]>(INITIAL_MODULES);
  const [showArchived, setShowArchived] = useState(false);
  const [addForm, setAddForm] = useState<InlineNodeForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSort, setEditSort] = useState("");

  function startAdd(parentId: string | null, level: ModuleLevel) {
    const siblings = nodes.filter((n) => n.parentId === parentId && !n.archived);
    setAddForm({ parentId, level, name: "", sortOrder: String(siblings.length + 1) });
    setEditId(null);
  }

  function commitAdd() {
    if (!addForm || !addForm.name.trim()) return;
    const newNode: ModuleNode = {
      id: uid(),
      name: addForm.name.trim(),
      level: addForm.level,
      sortOrder: parseInt(addForm.sortOrder, 10) || 1,
      parentId: addForm.parentId,
      archived: false,
    };
    setNodes((prev) => [...prev, newNode]);
    setAddForm(null);
  }

  function startEdit(node: ModuleNode) {
    setEditId(node.id);
    setEditName(node.name);
    setEditSort(String(node.sortOrder));
    setAddForm(null);
  }

  function commitEdit(id: string) {
    setNodes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, name: editName.trim() || n.name, sortOrder: parseInt(editSort, 10) || n.sortOrder } : n
      )
    );
    setEditId(null);
  }

  function toggleArchive(id: string) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, archived: !n.archived } : n)));
  }

  function renderTree(parentId: string | null, level: ModuleLevel) {
    const children = nodes
      .filter((n) => n.parentId === parentId && n.level === level && (showArchived || !n.archived))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const nextLevel: ModuleLevel | null = level === "product" ? "module" : level === "module" ? "submodule" : null;

    return children.map((node) => (
      <div key={node.id} className={LEVEL_INDENT[level]}>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 transition-colors ${node.archived ? "opacity-40" : "hover:bg-surface-container-low"}`}
        >
          {editId === node.id ? (
            <div className="flex flex-1 items-center gap-2">
              <input
                autoFocus
                className="h-[32px] flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(node.id); if (e.key === "Escape") setEditId(null); }}
              />
              <input
                className="h-[32px] w-16 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                placeholder="Sort"
                type="number"
                value={editSort}
                onChange={(e) => setEditSort(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(node.id); if (e.key === "Escape") setEditId(null); }}
              />
              <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={() => commitEdit(node.id)} type="button">Save</button>
              <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setEditId(null)} type="button">Cancel</button>
            </div>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">
                {level === "product" ? "folder" : level === "module" ? "article" : "subdirectory_arrow_right"}
              </span>
              <span className="flex-1 font-body-md text-body-md text-on-surface">{node.name}</span>
              <span className={`rounded-full border px-2 py-0.5 font-label-md text-[0.7rem] ${LEVEL_BADGE[node.level]}`}>{node.level}</span>
              <span className="text-label-md text-on-surface-variant">#{node.sortOrder}</span>
              {!node.archived && (
                <button className="rounded-lg px-2 py-1 font-label-md text-[0.75rem] text-on-surface-variant hover:bg-surface-container-low" onClick={() => startEdit(node)} type="button">Edit</button>
              )}
              <button
                className={`rounded-lg px-2 py-1 font-label-md text-[0.75rem] ${node.archived ? "text-primary hover:bg-surface-container-low" : "text-error hover:bg-error-container/30"}`}
                onClick={() => toggleArchive(node.id)}
                type="button"
              >
                {node.archived ? "Restore" : "Archive"}
              </button>
            </>
          )}
        </div>

        {/* Children */}
        {nextLevel && renderTree(node.id, nextLevel)}

        {/* Inline add form for children */}
        {nextLevel && addForm?.parentId === node.id && addForm.level === nextLevel && (
          <div className={`${LEVEL_INDENT[nextLevel]} mt-1 flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary-fixed/10 px-3 py-2`}>
            <input
              autoFocus
              className="h-[32px] flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
              placeholder={`New ${nextLevel} name`}
              value={addForm.name}
              onChange={(e) => setAddForm((f) => f ? { ...f, name: e.target.value } : f)}
              onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAddForm(null); }}
            />
            <input
              className="h-[32px] w-16 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
              placeholder="Sort"
              type="number"
              value={addForm.sortOrder}
              onChange={(e) => setAddForm((f) => f ? { ...f, sortOrder: e.target.value } : f)}
            />
            <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={commitAdd} type="button">Add</button>
            <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setAddForm(null)} type="button">Cancel</button>
          </div>
        )}

        {/* Add child button */}
        {nextLevel && !node.archived && addForm?.parentId !== node.id && (
          <div className={LEVEL_INDENT[nextLevel]}>
            <button
              className="mt-1 flex items-center gap-1 rounded-lg px-2 py-1 font-label-md text-[0.75rem] text-on-surface-variant hover:bg-surface-container-low"
              onClick={() => startAdd(node.id, nextLevel)}
              type="button"
            >
              <span className="material-symbols-outlined text-[14px]">add</span>
              Add {nextLevel}
            </button>
          </div>
        )}
      </div>
    ));
  }

  const hasArchived = nodes.some((n) => n.archived);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Product Hierarchy</h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Three-level hierarchy: Product → Module → Submodule.</p>
          </div>
          <div className="flex items-center gap-2">
            {hasArchived && (
              <button
                className={`rounded-xl border border-outline-variant px-stack-md py-stack-sm font-label-md text-label-md transition-colors ${showArchived ? "bg-inverse-surface text-inverse-on-surface" : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-low"}`}
                onClick={() => setShowArchived((v) => !v)}
                type="button"
              >
                {showArchived ? "Hide archived" : "Show archived"}
              </button>
            )}
            <button
              className="flex items-center gap-1 rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
              onClick={() => startAdd(null, "product")}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add product
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {renderTree(null, "product")}

          {addForm?.parentId === null && addForm?.level === "product" && (
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary-fixed/10 px-3 py-2">
              <input
                autoFocus
                className="h-[32px] flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                placeholder="New product name"
                value={addForm.name}
                onChange={(e) => setAddForm((f) => f ? { ...f, name: e.target.value } : f)}
                onKeyDown={(e) => { if (e.key === "Enter") commitAdd(); if (e.key === "Escape") setAddForm(null); }}
              />
              <input
                className="h-[32px] w-16 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                placeholder="Sort"
                type="number"
                value={addForm.sortOrder}
                onChange={(e) => setAddForm((f) => f ? { ...f, sortOrder: e.target.value } : f)}
              />
              <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={commitAdd} type="button">Add</button>
              <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setAddForm(null)} type="button">Cancel</button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-section: Users
// ─────────────────────────────────────────────

function UsersSection() {
  const [users, setUsers] = useState<UserRow[]>(INITIAL_USERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("dev");
  const [editRoleId, setEditRoleId] = useState<string | null>(null);

  function toggleActive(id: string) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, active: !u.active } : u)));
  }

  function updateRole(id: string, role: UserRole) {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    setEditRoleId(null);
  }

  function inviteUser() {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setUsers((prev) => [
      ...prev,
      { id: uid(), name: inviteName.trim(), email: inviteEmail.trim(), role: inviteRole, active: true },
    ]);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("dev");
    setShowInvite(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Workspace Users</h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Manage roles and access for each member.</p>
          </div>
          <button
            className="flex items-center gap-1 rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
            onClick={() => setShowInvite((v) => !v)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Invite user
          </button>
        </div>

        {showInvite && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-fixed/10 p-4">
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant">Name</label>
              <input
                autoFocus
                className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                placeholder="Full name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant">Email</label>
              <input
                className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                placeholder="email@domain.com"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant">Role</label>
              <select
                className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
              >
                {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={inviteUser} type="button">Invite</button>
            <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setShowInvite(false)} type="button">Cancel</button>
          </div>
        )}

        <div className="overflow-x-auto rounded-2xl border border-outline-variant">
          <table className="min-w-[600px] w-full border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container-high">
              <tr>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Name</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Email</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Role</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Status</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Actions</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {users.map((user) => (
                <tr key={user.id} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-lowest/60">
                  <td className="px-stack-md py-stack-sm font-medium">{user.name}</td>
                  <td className="px-stack-md py-stack-sm text-on-surface-variant">{user.email}</td>
                  <td className="px-stack-md py-stack-sm">
                    {editRoleId === user.id ? (
                      <select
                        autoFocus
                        className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value as UserRole)}
                        onBlur={() => setEditRoleId(null)}
                      >
                        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        className={`rounded-full border px-2 py-0.5 font-label-md text-[0.75rem] transition-opacity hover:opacity-80 ${ROLE_BADGE[user.role]}`}
                        title="Click to edit role"
                        onClick={() => setEditRoleId(user.id)}
                        type="button"
                      >
                        {ROLE_LABELS[user.role]}
                      </button>
                    )}
                  </td>
                  <td className="px-stack-md py-stack-sm">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-label-md text-[0.75rem] ${user.active ? "border-emerald-300 bg-emerald-100 text-emerald-800" : "border-outline-variant bg-surface-container-low text-on-surface-variant"}`}
                    >
                      {user.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-stack-md py-stack-sm">
                    <button
                      className={`rounded-lg px-2 py-1 font-label-md text-[0.75rem] transition-colors ${user.active ? "text-error hover:bg-error-container/30" : "text-primary hover:bg-primary-fixed/20"}`}
                      onClick={() => toggleActive(user.id)}
                      type="button"
                    >
                      {user.active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-section: SLA
// ─────────────────────────────────────────────

const BREACH_ACTION_LABELS: Record<BreachAction, string> = {
  slack_immediate: "Slack (immediate)",
  daily_digest_flag: "Daily digest flag",
  weekly_digest_flag: "Weekly digest flag",
};

function SlaSection() {
  const [rows, setRows] = useState<SlaRow[]>(INITIAL_SLA);
  const [staleThreshold, setStaleThreshold] = useState(60);
  const [notifyFullTeam, setNotifyFullTeam] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function updateRow(priority: string, field: keyof SlaRow, value: string | number | null) {
    setRows((prev) => prev.map((r) => (r.priority === priority ? { ...r, [field]: value } : r)));
  }

  function save() {
    setToast("SLA policy saved (local only).");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="flex flex-col gap-4">
      {toast && (
        <div className="rounded-2xl border border-primary-fixed-dim bg-primary-fixed px-4 py-3 text-body-md text-on-primary-fixed-variant">
          {toast}
        </div>
      )}

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <h2 className="font-headline-md text-headline-md text-on-surface">Priority SLA Targets</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Set triage and resolution hour targets, and breach notification action per priority level.</p>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-outline-variant">
          <table className="min-w-[560px] w-full border-collapse text-left">
            <thead className="border-b border-outline-variant bg-surface-container-high">
              <tr>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Priority</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Triage (hrs)</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Resolution (hrs)</th>
                <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Breach Action</th>
              </tr>
            </thead>
            <tbody className="font-body-md text-body-md text-on-surface">
              {rows.map((row) => (
                <tr key={row.priority} className="border-b border-outline-variant last:border-b-0">
                  <td className="px-stack-md py-stack-sm">
                    <span className={`rounded-full border px-2 py-0.5 font-label-md text-[0.75rem] font-semibold ${
                      row.priority === "P0" ? "border-red-300 bg-red-100 text-red-800" :
                      row.priority === "P1" ? "border-orange-300 bg-orange-100 text-orange-800" :
                      row.priority === "P2" ? "border-yellow-300 bg-yellow-100 text-yellow-800" :
                      "border-outline-variant bg-surface-container-low text-on-surface-variant"
                    }`}>{row.priority}</span>
                  </td>
                  <td className="px-stack-md py-stack-sm">
                    <input
                      className="h-[32px] w-20 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                      min={1}
                      type="number"
                      value={row.triageHours}
                      onChange={(e) => updateRow(row.priority, "triageHours", parseInt(e.target.value, 10) || 1)}
                    />
                  </td>
                  <td className="px-stack-md py-stack-sm">
                    <input
                      className="h-[32px] w-24 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                      min={1}
                      placeholder="—"
                      type="number"
                      value={row.resolutionHours ?? ""}
                      onChange={(e) => updateRow(row.priority, "resolutionHours", e.target.value ? parseInt(e.target.value, 10) : null)}
                    />
                  </td>
                  <td className="px-stack-md py-stack-sm">
                    <select
                      className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                      value={row.breachAction}
                      onChange={(e) => updateRow(row.priority, "breachAction", e.target.value as BreachAction)}
                    >
                      {(Object.keys(BREACH_ACTION_LABELS) as BreachAction[]).map((a) => (
                        <option key={a} value={a}>{BREACH_ACTION_LABELS[a]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <h2 className="font-headline-md text-headline-md text-on-surface">Stale Ticket Policy</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Flag tickets that have not been updated within the threshold period.</p>

        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md text-on-surface-variant">Threshold (days)</label>
            <input
              className="h-[32px] w-24 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
              min={1}
              type="number"
              value={staleThreshold}
              onChange={(e) => setStaleThreshold(parseInt(e.target.value, 10) || 60)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              className={`relative h-6 w-11 rounded-full transition-colors ${notifyFullTeam ? "bg-primary" : "bg-outline-variant"}`}
              type="button"
              onClick={() => setNotifyFullTeam((v) => !v)}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${notifyFullTeam ? "translate-x-5" : "translate-x-0.5"}`}
              />
            </button>
            <span className="font-body-md text-body-md text-on-surface">Notify full team on stale tickets</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          className="rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary shadow-sm"
          onClick={save}
          type="button"
        >
          Save changes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-section: Routing
// ─────────────────────────────────────────────

function RoutingSection() {
  const [activeTab, setActiveTab] = useState<"pm" | "auto">("pm");
  const [pmRules, setPmRules] = useState<PmRule[]>([]);
  const [autoRules, setAutoRules] = useState<AutoRule[]>([]);

  // PM rule add form
  const [showPmForm, setShowPmForm] = useState(false);
  const [pmModule, setPmModule] = useState("");
  const [pmUser, setPmUser] = useState("");

  // Auto rule add form
  const [showAutoForm, setShowAutoForm] = useState(false);
  const [autoField, setAutoField] = useState("");
  const [autoValue, setAutoValue] = useState("");
  const [autoActionType, setAutoActionType] = useState("");
  const [autoActionValue, setAutoActionValue] = useState("");

  function addPmRule() {
    if (!pmModule.trim() || !pmUser.trim()) return;
    setPmRules((prev) => [...prev, { id: uid(), module: pmModule.trim(), pm: pmUser.trim() }]);
    setPmModule("");
    setPmUser("");
    setShowPmForm(false);
  }

  function deletePmRule(id: string) {
    setPmRules((prev) => prev.filter((r) => r.id !== id));
  }

  function addAutoRule() {
    if (!autoField.trim() || !autoActionType.trim()) return;
    setAutoRules((prev) => [
      ...prev,
      { id: uid(), conditionField: autoField.trim(), conditionValue: autoValue.trim(), actionType: autoActionType.trim(), actionValue: autoActionValue.trim(), autoApply: false },
    ]);
    setAutoField("");
    setAutoValue("");
    setAutoActionType("");
    setAutoActionValue("");
    setShowAutoForm(false);
  }

  function deleteAutoRule(id: string) {
    setAutoRules((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleAutoApply(id: string) {
    setAutoRules((prev) => prev.map((r) => (r.id === id ? { ...r, autoApply: !r.autoApply } : r)));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        <button
          className={activeTab === "pm" ? "rounded-2xl border border-inverse-surface bg-inverse-surface px-3 py-2 text-[0.98rem] font-medium text-inverse-on-surface shadow-sm" : "rounded-2xl px-3 py-2 text-[0.98rem] text-on-surface-variant hover:bg-surface-container-low"}
          onClick={() => setActiveTab("pm")}
          type="button"
        >
          PM Assignment
        </button>
        <button
          className={activeTab === "auto" ? "rounded-2xl border border-inverse-surface bg-inverse-surface px-3 py-2 text-[0.98rem] font-medium text-inverse-on-surface shadow-sm" : "rounded-2xl px-3 py-2 text-[0.98rem] text-on-surface-variant hover:bg-surface-container-low"}
          onClick={() => setActiveTab("auto")}
          type="button"
        >
          Auto-routing
        </button>
      </div>

      {activeTab === "pm" && (
        <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">PM Assignment Rules</h2>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Map modules to their responsible PM.</p>
            </div>
            <button
              className="flex items-center gap-1 rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
              onClick={() => setShowPmForm((v) => !v)}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add rule
            </button>
          </div>

          {showPmForm && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-fixed/10 p-4">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Module</label>
                <input
                  autoFocus
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  placeholder="Module name"
                  value={pmModule}
                  onChange={(e) => setPmModule(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">PM User</label>
                <input
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  placeholder="PM name or email"
                  value={pmUser}
                  onChange={(e) => setPmUser(e.target.value)}
                />
              </div>
              <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={addPmRule} type="button">Add</button>
              <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setShowPmForm(false)} type="button">Cancel</button>
            </div>
          )}

          {pmRules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
              No PM assignment rules yet. Add a rule to map a module to a PM.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-outline-variant">
              <table className="min-w-[400px] w-full border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container-high">
                  <tr>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Module</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">PM</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant" />
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface">
                  {pmRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-lowest/60">
                      <td className="px-stack-md py-stack-sm">{rule.module}</td>
                      <td className="px-stack-md py-stack-sm text-on-surface-variant">{rule.pm}</td>
                      <td className="px-stack-md py-stack-sm text-right">
                        <button
                          className="rounded-lg px-2 py-1 font-label-md text-[0.75rem] text-error hover:bg-error-container/30"
                          onClick={() => deletePmRule(rule.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "auto" && (
        <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-headline-md text-headline-md text-on-surface">Auto-routing Rules</h2>
              <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Automatically assign or route tickets based on field conditions.</p>
            </div>
            <button
              className="flex items-center gap-1 rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
              onClick={() => setShowAutoForm((v) => !v)}
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add rule
            </button>
          </div>

          {showAutoForm && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-primary/40 bg-primary-fixed/10 p-4">
              {[
                { label: "Condition Field", value: autoField, set: setAutoField, placeholder: "e.g. priority" },
                { label: "Condition Value", value: autoValue, set: setAutoValue, placeholder: "e.g. P0" },
                { label: "Action Type", value: autoActionType, set: setAutoActionType, placeholder: "e.g. assign_to" },
                { label: "Action Value", value: autoActionValue, set: setAutoActionValue, placeholder: "e.g. user@em.com" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label} className="flex flex-col gap-1">
                  <label className="font-label-md text-label-md text-on-surface-variant">{label}</label>
                  <input
                    className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                    placeholder={placeholder}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                </div>
              ))}
              <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={addAutoRule} type="button">Add</button>
              <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setShowAutoForm(false)} type="button">Cancel</button>
            </div>
          )}

          {autoRules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
              No auto-routing rules yet. Add a rule to define conditional ticket routing logic.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-outline-variant">
              <table className="min-w-[640px] w-full border-collapse text-left">
                <thead className="border-b border-outline-variant bg-surface-container-high">
                  <tr>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Condition Field</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Condition Value</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Action Type</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Action Value</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Auto Apply</th>
                    <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant" />
                  </tr>
                </thead>
                <tbody className="font-body-md text-body-md text-on-surface">
                  {autoRules.map((rule) => (
                    <tr key={rule.id} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-lowest/60">
                      <td className="px-stack-md py-stack-sm">{rule.conditionField}</td>
                      <td className="px-stack-md py-stack-sm text-on-surface-variant">{rule.conditionValue || "—"}</td>
                      <td className="px-stack-md py-stack-sm">{rule.actionType}</td>
                      <td className="px-stack-md py-stack-sm text-on-surface-variant">{rule.actionValue || "—"}</td>
                      <td className="px-stack-md py-stack-sm">
                        <button
                          className={`relative h-5 w-9 rounded-full transition-colors ${rule.autoApply ? "bg-primary" : "bg-outline-variant"}`}
                          type="button"
                          onClick={() => toggleAutoApply(rule.id)}
                        >
                          <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${rule.autoApply ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </td>
                      <td className="px-stack-md py-stack-sm text-right">
                        <button
                          className="rounded-lg px-2 py-1 font-label-md text-[0.75rem] text-error hover:bg-error-container/30"
                          onClick={() => deleteAutoRule(rule.id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-section: Themes
// ─────────────────────────────────────────────

const DEFAULT_THEMES = [
  "Data Quality", "UX & Navigation", "Performance", "Integration",
  "Reporting", "Automation", "Security", "Onboarding",
];

interface ThemeItem {
  id: string;
  name: string;
  archived: boolean;
}

function ThemesSection() {
  const [themes, setThemes] = useState<ThemeItem[]>(
    DEFAULT_THEMES.map((name) => ({ id: uid(), name, archived: false }))
  );
  const [newTheme, setNewTheme] = useState("");

  function addTheme() {
    if (!newTheme.trim()) return;
    if (themes.some((t) => t.name.toLowerCase() === newTheme.trim().toLowerCase())) return;
    setThemes((prev) => [...prev, { id: uid(), name: newTheme.trim(), archived: false }]);
    setNewTheme("");
  }

  function archiveTheme(id: string) {
    setThemes((prev) => prev.map((t) => (t.id === id ? { ...t, archived: true } : t)));
  }

  function restoreTheme(id: string) {
    setThemes((prev) => prev.map((t) => (t.id === id ? { ...t, archived: false } : t)));
  }

  const active = themes.filter((t) => !t.archived);
  const archived = themes.filter((t) => t.archived);

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <h2 className="font-headline-md text-headline-md text-on-surface">Active Themes</h2>
        <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Tags used to categorise tickets and templates by feature area.</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {active.map((theme) => (
            <span key={theme.id} className="flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-label-md text-label-md text-on-surface">
              {theme.name}
              <button
                className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-error-container/40 hover:text-error"
                title="Archive theme"
                onClick={() => archiveTheme(theme.id)}
                type="button"
              >
                <span className="material-symbols-outlined text-[12px]">close</span>
              </button>
            </span>
          ))}

          {active.length === 0 && (
            <span className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
              All themes have been archived. Add a new one below.
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
            placeholder="New theme name"
            value={newTheme}
            onChange={(e) => setNewTheme(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addTheme(); }}
          />
          <button
            className="flex items-center gap-1 rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary"
            onClick={addTheme}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Add theme
          </button>
        </div>
      </section>

      {archived.length > 0 && (
        <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin opacity-70 shadow-[var(--shadow-panel)]">
          <h2 className="font-headline-md text-headline-md text-on-surface">Archived Themes</h2>
          <p className="mt-1 font-body-md text-body-md text-on-surface-variant">These themes are hidden from selection. Restore to make them available again.</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {archived.map((theme) => (
              <span key={theme.id} className="flex items-center gap-1 rounded-full border border-dashed border-outline-variant bg-surface-container-low px-3 py-1 font-label-md text-label-md text-on-surface-variant line-through">
                {theme.name}
                <button
                  className="ml-1 flex h-4 w-4 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary-fixed/30"
                  title="Restore theme"
                  onClick={() => restoreTheme(theme.id)}
                  type="button"
                >
                  <span className="material-symbols-outlined text-[12px]">restore</span>
                </button>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-section: Templates
// ─────────────────────────────────────────────

const EFFORT_OPTIONS = ["XS", "S", "M", "L", "XL"];
const CATEGORY_OPTIONS = ["Bug", "Feature Request", "Infrastructure", "Research", "Onboarding", "Security", "Reporting"];

function TemplatesSection() {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formTrigger, setFormTrigger] = useState("");
  const [formRefined, setFormRefined] = useState("");
  const [formEffort, setFormEffort] = useState("M");
  const [formCategory, setFormCategory] = useState("Feature Request");

  function addTemplate() {
    if (!formName.trim()) return;
    setTemplates((prev) => [
      ...prev,
      {
        id: uid(),
        name: formName.trim(),
        triggerType: formTrigger.trim(),
        refinedTask: formRefined.trim(),
        effortEstimate: formEffort,
        category: formCategory,
      },
    ]);
    setFormName("");
    setFormTrigger("");
    setFormRefined("");
    setFormEffort("M");
    setFormCategory("Feature Request");
    setShowForm(false);
  }

  function deleteTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-margin shadow-[var(--shadow-panel)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Request Templates</h2>
            <p className="mt-1 font-body-md text-body-md text-on-surface-variant">Pre-defined templates that populate new request forms based on trigger conditions.</p>
          </div>
          <button
            className="flex items-center gap-1 rounded-xl bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary"
            onClick={() => setShowForm((v) => !v)}
            type="button"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New template
          </button>
        </div>

        {showForm && (
          <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-dashed border-primary/40 bg-primary-fixed/10 p-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Template Name</label>
                <input
                  autoFocus
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  placeholder="e.g. Bug report"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Trigger Type</label>
                <input
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  placeholder="e.g. manual, alert, webhook"
                  value={formTrigger}
                  onChange={(e) => setFormTrigger(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Effort Estimate</label>
                <select
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  value={formEffort}
                  onChange={(e) => setFormEffort(e.target.value)}
                >
                  {EFFORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-label-md text-on-surface-variant">Category</label>
                <select
                  className="h-[32px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm font-body-md focus:border-primary focus:outline-none"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-label-md text-on-surface-variant">Refined Task Template</label>
              <textarea
                className="min-h-[80px] rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm py-2 font-body-md focus:border-primary focus:outline-none"
                placeholder="Describe the task steps or instructions that will be pre-filled..."
                value={formRefined}
                onChange={(e) => setFormRefined(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button className="rounded-xl bg-primary-container px-stack-md py-stack-sm font-label-md text-label-md text-on-primary" onClick={addTemplate} type="button">Save template</button>
              <button className="rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-md py-stack-sm font-label-md text-label-md text-on-surface hover:bg-surface-container-low" onClick={() => setShowForm(false)} type="button">Cancel</button>
            </div>
          </div>
        )}

        {templates.length === 0 && !showForm ? (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-container-low p-4 text-body-md text-on-surface-variant">
            No templates yet. Create your first template to start pre-filling request forms.
          </div>
        ) : templates.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-outline-variant">
            <table className="min-w-[600px] w-full border-collapse text-left">
              <thead className="border-b border-outline-variant bg-surface-container-high">
                <tr>
                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Name</th>
                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Trigger Type</th>
                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Effort</th>
                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant">Category</th>
                  <th className="px-stack-md py-stack-sm font-label-md text-label-md text-on-surface-variant" />
                </tr>
              </thead>
              <tbody className="font-body-md text-body-md text-on-surface">
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="border-b border-outline-variant last:border-b-0 hover:bg-surface-container-lowest/60">
                    <td className="px-stack-md py-stack-sm font-medium">{tpl.name}</td>
                    <td className="px-stack-md py-stack-sm text-on-surface-variant">{tpl.triggerType || "—"}</td>
                    <td className="px-stack-md py-stack-sm">
                      <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-md text-[0.75rem] text-on-surface-variant">{tpl.effortEstimate}</span>
                    </td>
                    <td className="px-stack-md py-stack-sm text-on-surface-variant">{tpl.category}</td>
                    <td className="px-stack-md py-stack-sm text-right">
                      <button
                        className="rounded-lg px-2 py-1 font-label-md text-[0.75rem] text-error hover:bg-error-container/30"
                        onClick={() => deleteTemplate(tpl.id)}
                        type="button"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const section = resolveSection(searchParams.get("section"));

  function setActiveSection(next: AdminSection) {
    const params = new URLSearchParams(searchParams);
    params.set("section", next);
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-background lg:flex-row">
      {/* Left nav */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface-container-lowest/92 px-3 py-3 sm:px-4 lg:w-64 lg:border-b-0 lg:border-r lg:px-margin lg:py-margin">
        <h2 className="font-label-md text-[0.95rem] uppercase tracking-[0.14em] text-on-surface-variant">Admin Panel</h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
          {(Object.keys(SECTION_LABELS) as AdminSection[]).map((key) => (
            <button
              key={key}
              className={
                section === key
                  ? "flex shrink-0 items-center gap-2 rounded-2xl border border-inverse-surface bg-inverse-surface px-3 py-2 text-[0.98rem] font-medium text-inverse-on-surface shadow-sm"
                  : "flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-[0.98rem] text-on-surface-variant transition-colors hover:bg-surface-container-low"
              }
              onClick={() => setActiveSection(key)}
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">{SECTION_ICONS[key]}</span>
              <span>{SECTION_LABELS[key]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 max-w-5xl flex-1 flex-col gap-4 px-3 py-4 sm:gap-margin sm:p-margin">
        {/* Page heading */}
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">{SECTION_LABELS[section]}</h1>
          <p className="mt-stack-sm font-body-md text-body-md text-on-surface-variant">{sectionDescription(section)}</p>
        </div>

        {/* API warning banner */}
        <div className="flex items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-body-md text-amber-800">
          <span className="material-symbols-outlined text-[18px]">construction</span>
          <span>Not connected to API — changes are local only and will reset on page refresh.</span>
        </div>

        {/* Section content */}
        {section === "modules" && <ModulesSection />}
        {section === "users" && <UsersSection />}
        {section === "sla" && <SlaSection />}
        {section === "routing" && <RoutingSection />}
        {section === "themes" && <ThemesSection />}
        {section === "templates" && <TemplatesSection />}
      </div>
    </div>
  );
}

function sectionDescription(section: AdminSection): string {
  switch (section) {
    case "modules": return "Manage the three-level product hierarchy used to categorise all tickets and requests.";
    case "users": return "View and manage workspace members, their roles, and access status.";
    case "sla": return "Configure triage and resolution targets per priority level, and set breach notification behaviour.";
    case "routing": return "Define PM assignment rules and automatic routing conditions for incoming tickets.";
    case "themes": return "Manage the theme tags available when categorising tickets and templates.";
    case "templates": return "Create and manage reusable request templates that pre-fill new ticket forms.";
  }
}
