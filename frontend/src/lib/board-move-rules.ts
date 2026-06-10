import { canMarkCardComplete, type BoardCard } from "@emergence-devops/shared";

const READ_ONLY_DESTINATIONS = new Set(["not_started"]);

type DroppableCard = Pick<BoardCard, "activityCounts" | "links" | "manualCompletion">;

export function canDropIntoColumn(columnKey: string, card?: DroppableCard) {
  if (READ_ONLY_DESTINATIONS.has(columnKey)) {
    return false;
  }

  if (columnKey === "done") {
    return card ? canMarkCardComplete(card) : false;
  }

  return true;
}

export function requiresDueDate(columnKey: string) {
  return columnKey === "active";
}

export function columnBehaviorLabel(columnKey: string) {
  if (columnKey === "not_started") {
    return "Read only";
  }

  if (columnKey === "done") {
    return "Requires closed PR, commit, or Manual";
  }

  if (columnKey === "active") {
    return "Requires due date";
  }

  if (columnKey === "backlog") {
    return "Manual hold";
  }

  return "Open for moves";
}
