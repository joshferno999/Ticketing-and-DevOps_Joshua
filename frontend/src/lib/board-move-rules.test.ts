import type { BoardCard } from "@emergence-devops/shared";
import { describe, expect, it } from "vitest";
import { canDropIntoColumn, columnBehaviorLabel, requiresDueDate } from "./board-move-rules";

const emptyActivity = {
  commits: 0,
  pullRequests: 0,
  openPullRequests: 0,
  completedPullRequests: 0
};

function cardWithActivity(
  activityCounts: BoardCard["activityCounts"],
  links: BoardCard["links"] = [],
  manualCompletion = false
): Pick<BoardCard, "activityCounts" | "links" | "manualCompletion"> {
  return { activityCounts, links, manualCompletion };
}

describe("board move rules", () => {
  it("blocks drops into not started", () => {
    expect(canDropIntoColumn("not_started")).toBe(false);
  });

  it("allows done only when a card has a closed PR or commit", () => {
    expect(canDropIntoColumn("done")).toBe(false);
    expect(canDropIntoColumn("done", cardWithActivity(emptyActivity))).toBe(false);
    expect(
      canDropIntoColumn(
        "done",
        cardWithActivity({ ...emptyActivity, commits: 1 })
      )
    ).toBe(true);
    expect(
      canDropIntoColumn(
        "done",
        cardWithActivity(
          { ...emptyActivity, completedPullRequests: 1 },
          [{ id: "1", type: "pull_request", title: "PR", url: "https://example.com", state: "closed", authoredAt: "", authorName: "" }]
        )
      )
    ).toBe(true);
    expect(canDropIntoColumn("done", cardWithActivity(emptyActivity, [], true))).toBe(true);
  });

  it("allows drops into backlog, active, and review", () => {
    expect(canDropIntoColumn("backlog")).toBe(true);
    expect(canDropIntoColumn("active")).toBe(true);
    expect(canDropIntoColumn("review")).toBe(true);
  });

  it("requires a due date only for in progress", () => {
    expect(requiresDueDate("active")).toBe(true);
    expect(requiresDueDate("backlog")).toBe(false);
    expect(requiresDueDate("review")).toBe(false);
    expect(requiresDueDate("done")).toBe(false);
  });

  it("labels readonly columns clearly", () => {
    expect(columnBehaviorLabel("not_started")).toContain("Read only");
    expect(columnBehaviorLabel("done")).toContain("Manual");
  });
});
