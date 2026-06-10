import type { RepositoryCommitGraphResponse } from "@emergence-devops/shared";
import {
  buildLaneLayout,
  buildSvgPrimitives,
  layoutOptionsFromGit,
  toTimelineRowsFromGit,
  type BranchTrackingInfo,
  type GitAnnotatedRow,
  type GraphSvgPrimitives,
  type TimelineRow
} from "graph-lab";

export const COMMIT_GRAPH_ROW_HEIGHT = 48;
export const COMMIT_GRAPH_HEADER_HEIGHT = 44;

export interface RepositoryGraphModel {
  rows: TimelineRow[];
  svg: GraphSvgPrimitives;
}

export function buildRepositoryGraphModel(
  data: RepositoryCommitGraphResponse,
  currentBranch: string
): RepositoryGraphModel {
  const gitRows: GitAnnotatedRow[] = data.commits.map((commit) => ({
    id: commit.sha,
    parents: commit.parentShas,
    refs: commit.branchHeadNames.map((name) => ({
      type: name === currentBranch ? "head" : "branch",
      name
    }))
  }));

  const rows = toTimelineRowsFromGit(gitRows);
  const branches: BranchTrackingInfo[] = data.branchOptions.map((branch) => ({
    name: branch.name,
    current: branch.name === currentBranch,
    hash: branch.headSha,
    ahead: 0,
    behind: 0
  }));

  const layout = buildLaneLayout(rows, layoutOptionsFromGit(gitRows, branches));
  const svg = buildSvgPrimitives(
    layout,
    {
      rowHeight: COMMIT_GRAPH_ROW_HEIGHT,
      strokeWidth: 2.2,
      dotRadius: 8,
      junctionGlyphRadius: 7,
      xScale: 1.15
    },
    rows
  );

  return {
    rows,
    svg
  };
}
