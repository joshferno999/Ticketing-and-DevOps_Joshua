import type { BoardCard, WorkspaceUserSummary } from "@emergence-devops/shared";

export const BOARD_ASSIGNEE_UNASSIGNED_KEY = "__unassigned__";

export type BoardCardSortKey = "default" | "created_asc" | "created_desc";

export interface BoardAssigneeFilterOption {
  key: string;
  label: string;
}

export function getCardAssigneeFilterKey(
  card: Pick<BoardCard, "assigneeAppUserId" | "assignee">
): string {
  if (card.assigneeAppUserId) {
    return card.assigneeAppUserId;
  }

  const assigneeName = card.assignee?.trim();
  if (assigneeName) {
    return `external:${assigneeName.toLowerCase()}`;
  }

  return BOARD_ASSIGNEE_UNASSIGNED_KEY;
}

export function buildAssigneeFilterOptions(
  cards: BoardCard[],
  workspaceUsers: WorkspaceUserSummary[]
): BoardAssigneeFilterOption[] {
  const options = new Map<string, string>();

  for (const workspaceUser of workspaceUsers) {
    options.set(workspaceUser.id, workspaceUser.displayName);
  }

  for (const card of cards) {
    const key = getCardAssigneeFilterKey(card);
    if (key.startsWith("external:") && card.assignee) {
      options.set(key, card.assignee);
    }
  }

  if (cards.some((card) => getCardAssigneeFilterKey(card) === BOARD_ASSIGNEE_UNASSIGNED_KEY)) {
    options.set(BOARD_ASSIGNEE_UNASSIGNED_KEY, "Unassigned");
  }

  return Array.from(options.entries())
    .map(([key, label]) => ({ key, label }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function matchesAssigneeFilter(card: BoardCard, selectedKeys: ReadonlySet<string>) {
  if (selectedKeys.size === 0) {
    return true;
  }

  return selectedKeys.has(getCardAssigneeFilterKey(card));
}

export function matchesBoardTextFilter(card: BoardCard, query: string) {
  const term = query.trim().toLowerCase();
  if (!term) {
    return true;
  }

  return `${card.title} ${card.description} ${card.assignee ?? ""} ${card.tags.join(" ")}`
    .toLowerCase()
    .includes(term);
}

export function compareBoardCards(
  left: BoardCard,
  right: BoardCard,
  sortKey: BoardCardSortKey
) {
  if (sortKey === "created_asc") {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  }

  if (sortKey === "created_desc") {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }

  const leftPath = [...left.ancestryPath, left.asanaTaskGid].join("/");
  const rightPath = [...right.ancestryPath, right.asanaTaskGid].join("/");
  if (leftPath !== rightPath) {
    return leftPath.localeCompare(rightPath);
  }

  return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

export function filterAndSortBoardCards(input: {
  cards: BoardCard[];
  textQuery: string;
  assigneeFilterKeys: ReadonlySet<string>;
  sortKey: BoardCardSortKey;
}) {
  return [...input.cards]
    .filter((card) => matchesBoardTextFilter(card, input.textQuery))
    .filter((card) => matchesAssigneeFilter(card, input.assigneeFilterKeys))
    .sort((left, right) => compareBoardCards(left, right, input.sortKey));
}
