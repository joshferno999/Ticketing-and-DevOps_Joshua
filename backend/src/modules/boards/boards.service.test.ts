import type { BoardCard } from "@emergence-devops/shared";
import { describe, expect, it } from "vitest";
import { determineStatusKey, validateMoveTransition } from "./boards.service";

const completableCard: BoardCard = {
  id: "card_1",
  boardId: "board_1",
  asanaTaskGid: "1234567890",
  parentTaskGid: "1234567890",
  rootTaskGid: "1234567890",
  ancestryPath: [],
  nestingDepth: 0,
  title: "Ship feature",
  description: "",
  status: "review",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: [],
  manualCompletion: false,
  activityCounts: {
    commits: 1,
    pullRequests: 0,
    openPullRequests: 0,
    completedPullRequests: 0
  },
  links: []
};

describe("validateMoveTransition", () => {
  it("rejects moves into not started", () => {
    expect(() => validateMoveTransition({ targetColumnKey: "not_started" })).toThrow("Not Started");
  });

  it("requires completion evidence before moving into done", () => {
    expect(() => validateMoveTransition({ targetColumnKey: "done" })).toThrow("closed pull request");
    expect(() => validateMoveTransition({ targetColumnKey: "done" }, completableCard)).not.toThrow();
  });

  it("allows done when manual completion is enabled without dev activity", () => {
    expect(() =>
      validateMoveTransition(
        { targetColumnKey: "done" },
        {
          ...completableCard,
          manualCompletion: true,
          activityCounts: {
            commits: 0,
            pullRequests: 0,
            openPullRequests: 0,
            completedPullRequests: 0
          },
          links: []
        }
      )
    ).not.toThrow();
  });

  it("requires a due date for active moves", () => {
    expect(() => validateMoveTransition({ targetColumnKey: "active" })).toThrow("due date");
  });

  it("allows backlog and review moves", () => {
    expect(() => validateMoveTransition({ targetColumnKey: "backlog" })).not.toThrow();
    expect(() => validateMoveTransition({ targetColumnKey: "review" })).not.toThrow();
  });
});

describe("determineStatusKey", () => {
  it("maps completed tasks to done", () => {
    expect(determineStatusKey(true, null, null)).toBe("done");
  });

  it("keeps manual backlog overrides", () => {
    expect(determineStatusKey(false, "2099-01-01", "backlog")).toBe("backlog");
  });

  it("keeps manual review overrides", () => {
    expect(determineStatusKey(false, "2099-01-01", "review")).toBe("review");
    expect(determineStatusKey(false, "2000-01-01", "review")).toBe("review");
    expect(determineStatusKey(false, null, "review")).toBe("review");
  });

  it("maps incomplete tasks without due dates to not started", () => {
    expect(determineStatusKey(false, null, null)).toBe("not_started");
  });

  it("maps overdue tasks to backlog", () => {
    expect(determineStatusKey(false, "2000-01-01", null)).toBe("backlog");
  });

  it("maps future tasks to active", () => {
    expect(determineStatusKey(false, "2099-01-01", null)).toBe("active");
  });

  it("keeps manual backlog overrides even when due date changes", () => {
    expect(determineStatusKey(false, "2099-04-01", "backlog")).toBe("backlog");
  });

  it("lets done override manual review", () => {
    expect(determineStatusKey(true, "2099-04-01", "review")).toBe("done");
  });
});
