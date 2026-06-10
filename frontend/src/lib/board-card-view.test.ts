import type { BoardCard } from "@emergence-devops/shared";
import { describe, expect, it } from "vitest";
import {
  BOARD_ASSIGNEE_UNASSIGNED_KEY,
  buildAssigneeFilterOptions,
  compareBoardCards,
  filterAndSortBoardCards,
  getCardAssigneeFilterKey,
  matchesAssigneeFilter
} from "./board-card-view";

function sampleCard(overrides: Partial<BoardCard> = {}): BoardCard {
  return {
    id: "card_1",
    boardId: "board_1",
    asanaTaskGid: "1001",
    parentTaskGid: "1000",
    rootTaskGid: "1000",
    ancestryPath: [],
    nestingDepth: 0,
    title: "Alpha",
    description: "",
    status: "active",
    updatedAt: "2026-05-20T12:00:00.000Z",
    createdAt: "2026-05-10T12:00:00.000Z",
    tags: [],
    manualCompletion: false,
    activityCounts: {
      commits: 0,
      pullRequests: 0,
      openPullRequests: 0,
      completedPullRequests: 0
    },
    links: [],
    ...overrides
  };
}

describe("board card view helpers", () => {
  it("maps assignee filter keys for workspace, external, and unassigned cards", () => {
    expect(getCardAssigneeFilterKey({ assigneeAppUserId: "user_1", assignee: "Hari" })).toBe("user_1");
    expect(getCardAssigneeFilterKey({ assignee: "Asana Only" })).toBe("external:asana only");
    expect(getCardAssigneeFilterKey({})).toBe(BOARD_ASSIGNEE_UNASSIGNED_KEY);
  });

  it("filters cards by selected assignee keys", () => {
    const cards = [
      sampleCard({ id: "1", assigneeAppUserId: "user_1", assignee: "Hari" }),
      sampleCard({ id: "2", assigneeAppUserId: "user_2", assignee: "Alex" }),
      sampleCard({ id: "3" })
    ];

    expect(matchesAssigneeFilter(cards[0]!, new Set(["user_1"]))).toBe(true);
    expect(matchesAssigneeFilter(cards[1]!, new Set(["user_1"]))).toBe(false);
    expect(matchesAssigneeFilter(cards[2]!, new Set())).toBe(true);
  });

  it("builds assignee options from workspace users and board cards", () => {
    const options = buildAssigneeFilterOptions(
      [
        sampleCard({ assigneeAppUserId: "user_1", assignee: "Hari" }),
        sampleCard({ id: "card_2", assignee: "External Dev" }),
        sampleCard({ id: "card_3" })
      ],
      [{ id: "user_1", email: "hari@example.com", displayName: "Hari", mentionable: true }]
    );

    expect(options.map((option) => option.label)).toEqual(["External Dev", "Hari", "Unassigned"]);
  });

  it("sorts cards by created date", () => {
    const older = sampleCard({ id: "older", createdAt: "2026-05-01T00:00:00.000Z" });
    const newer = sampleCard({ id: "newer", createdAt: "2026-05-15T00:00:00.000Z" });

    expect(compareBoardCards(older, newer, "created_asc")).toBeLessThan(0);
    expect(compareBoardCards(older, newer, "created_desc")).toBeGreaterThan(0);
  });

  it("applies text filter, assignee filter, and sort together", () => {
    const cards = [
      sampleCard({
        id: "1",
        title: "Design review",
        assigneeAppUserId: "user_1",
        createdAt: "2026-05-01T00:00:00.000Z"
      }),
      sampleCard({
        id: "2",
        title: "Write docs",
        assigneeAppUserId: "user_2",
        createdAt: "2026-05-20T00:00:00.000Z"
      }),
      sampleCard({
        id: "3",
        title: "Design system",
        assigneeAppUserId: "user_1",
        createdAt: "2026-05-10T00:00:00.000Z"
      })
    ];

    const result = filterAndSortBoardCards({
      cards,
      textQuery: "design",
      assigneeFilterKeys: new Set(["user_1"]),
      sortKey: "created_desc"
    });

    expect(result.map((card) => card.id)).toEqual(["3", "1"]);
  });
});
