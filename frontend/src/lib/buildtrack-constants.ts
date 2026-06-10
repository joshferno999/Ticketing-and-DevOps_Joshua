/**
 * BuildTrack — Shared display constants
 *
 * Single source of truth for status/priority/type labels and styling.
 * Import these into any BuildTrack page instead of redefining locally.
 *
 * Integration note: when the API is wired up, these constants remain
 * UI-only — they map server-returned enum values → display strings/classes.
 */

// ─── Canonical types ──────────────────────────────────────────────────────────

export type RequestStatus =
  | "submitted"
  | "pending"
  | "in_review"
  | "in_sprint"
  | "in_progress"
  | "blocked"
  | "shipped"
  | "wont_fix"
  | "next_phase";

export type RequestType =
  | "bug"
  | "enhancement"
  | "new_feature"
  | "data_reporting"
  | "process_change"
  | "sponsor_build";

export type Priority = "P0" | "P1" | "P2" | "P3";

// ─── Status display ───────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<RequestStatus, string> = {
  submitted:   "Submitted",
  pending:     "In Review",
  in_review:   "In Review",
  in_sprint:   "In Progress",
  in_progress: "In Progress",
  blocked:     "Blocked",
  shipped:     "Shipped",
  wont_fix:    "Won't Fix",
  next_phase:  "Next Phase",
};

export const STATUS_CLASSES: Record<RequestStatus, string> = {
  submitted:   "bg-amber-100 text-amber-800 border border-amber-300",
  pending:     "bg-blue-100 text-blue-800 border border-blue-300",
  in_review:   "bg-blue-100 text-blue-800 border border-blue-300",
  in_sprint:   "bg-violet-100 text-violet-800 border border-violet-300",
  in_progress: "bg-violet-100 text-violet-800 border border-violet-300",
  blocked:     "bg-red-100 text-red-800 border border-red-300",
  shipped:     "bg-green-100 text-green-800 border border-green-300",
  wont_fix:    "bg-gray-100 text-gray-600 border border-gray-300",
  next_phase:  "bg-gray-100 text-gray-600 border border-gray-300",
};

// ─── Type display ─────────────────────────────────────────────────────────────

export const TYPE_LABELS: Record<RequestType, string> = {
  bug:            "Bug",
  enhancement:    "Enhancement",
  new_feature:    "New Feature",
  data_reporting: "Data Reporting",
  process_change: "Process Change",
  sponsor_build:  "Sponsor Build",
};

// ─── Priority display ─────────────────────────────────────────────────────────

export const PRIORITY_CLASSES: Record<Priority, string> = {
  P0: "bg-red-100 text-red-700 border border-red-300",
  P1: "bg-orange-100 text-orange-700 border border-orange-300",
  P2: "bg-amber-100 text-amber-700 border border-amber-300",
  P3: "bg-green-100 text-green-700 border border-green-300",
};

// ─── Avatar colours (keyed by first char of display name) ────────────────────

export const AVATAR_PALETTE: Record<string, string> = {
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

/** Returns a deterministic Tailwind bg+text class for a given display name. */
export function avatarClasses(name: string): string {
  const key = (name.charAt(0) ?? "").toUpperCase();
  return AVATAR_PALETTE[key] ?? "bg-surface-container text-on-surface";
}
