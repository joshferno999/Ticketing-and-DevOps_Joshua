export function canMarkCardComplete(card) {
    if (card.manualCompletion) {
        return true;
    }
    const hasCommit = card.activityCounts.commits > 0 ||
        (card.links?.some((link) => link.type === "commit") ?? false);
    const hasClosedPullRequest = card.activityCounts.completedPullRequests > 0 ||
        (card.links?.some((link) => link.type === "pull_request" &&
            (link.state === "closed" || link.state === "merged")) ?? false);
    return hasCommit || hasClosedPullRequest;
}
export const CARD_COMPLETION_REQUIREMENT_MESSAGE = "Link a closed pull request or commit, or enable Manual for non-coding tasks, before marking this task complete.";
