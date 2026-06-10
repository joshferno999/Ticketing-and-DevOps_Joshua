import { describe, expect, it } from "vitest";
import { canMarkCardComplete } from "./board-completion";

const emptyActivity = {
  commits: 0,
  pullRequests: 0,
  openPullRequests: 0,
  completedPullRequests: 0
};

describe("canMarkCardComplete", () => {
  it("requires a linked commit or closed pull request", () => {
    expect(canMarkCardComplete({ activityCounts: emptyActivity })).toBe(false);
    expect(canMarkCardComplete({ activityCounts: { ...emptyActivity, commits: 1 } })).toBe(true);
    expect(
      canMarkCardComplete({
        activityCounts: { ...emptyActivity, completedPullRequests: 1 }
      })
    ).toBe(true);
    expect(
      canMarkCardComplete({
        activityCounts: emptyActivity,
        links: [{ type: "pull_request", state: "merged" }]
      })
    ).toBe(true);
    expect(
      canMarkCardComplete({
        activityCounts: emptyActivity,
        links: [{ type: "pull_request", state: "open" }]
      })
    ).toBe(false);
    expect(
      canMarkCardComplete({
        manualCompletion: true,
        activityCounts: emptyActivity
      })
    ).toBe(true);
  });
});
