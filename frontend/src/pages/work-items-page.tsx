import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { AsanaParentTaskSearchResult, BoardSummary } from "@emergence-devops/shared";
import { BusyButtonLabel, InlineLoadingHint, TableRowsSkeleton } from "../components/ui/loading";
import { api, ApiError } from "../lib/api";
import { useSession } from "../hooks/use-session";
import { useWorkspaceCapabilities } from "../hooks/use-workspace-capabilities";
import { Link, useNavigate } from "react-router-dom";

export function WorkItemsPage() {
  const { loading, user } = useSession();
  const { capabilities } = useWorkspaceCapabilities();
  const canEditBoards = capabilities.canEditBoards;
  const navigate = useNavigate();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [showPicker, setShowPicker] = useState(false);
  const [taskSearch, setTaskSearch] = useState("");
  const deferredTaskSearch = useDeferredValue(taskSearch);
  const [taskResults, setTaskResults] = useState<AsanaParentTaskSearchResult[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [savingTaskGid, setSavingTaskGid] = useState<string | null>(null);
  const [starringBoardId, setStarringBoardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const boardsRequestRef = useRef(0);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    void refreshBoards();
  }, [loading, user]);

  async function refreshBoards() {
    const requestId = boardsRequestRef.current + 1;
    boardsRequestRef.current = requestId;

    try {
      const nextBoards = await api.getBoards();
      if (boardsRequestRef.current !== requestId) {
        return nextBoards;
      }

      setBoards(sortBoardsWithStarFirst(nextBoards));
      return nextBoards;
    } catch (cause) {
      if (boardsRequestRef.current === requestId) {
        setError(cause instanceof ApiError ? cause.message : "Work items could not be loaded.");
      }
      return [];
    } finally {
      if (boardsRequestRef.current === requestId) {
        setInitialLoadComplete(true);
      }
    }
  }

  useEffect(() => {
    if (!showPicker || deferredTaskSearch.trim().length < 2) {
      setTaskResults([]);
      return;
    }

    let active = true;
    setPickerLoading(true);
    void api.searchAsanaParentTasks(deferredTaskSearch)
      .then((results) => {
        if (active) {
          setTaskResults(results);
        }
      })
      .catch((cause) => {
        if (active) {
          setError(cause instanceof ApiError ? cause.message : "Asana tasks could not be searched.");
        }
      })
      .finally(() => {
        if (active) {
          setPickerLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deferredTaskSearch, showPicker]);

  const items = useMemo(() => {
    const term = deferredQuery.trim().toLowerCase();
    if (!term) {
      return boards;
    }

    return boards.filter((board) =>
      `${board.name} ${board.workspaceName} ${board.projectName}`
        .toLowerCase()
        .includes(term)
    );
  }, [boards, deferredQuery]);

  async function addParentTask(task: AsanaParentTaskSearchResult) {
    if (!canEditBoards) {
      setError("Connect Asana in Settings to import or update work items.");
      return;
    }

    setSavingTaskGid(task.gid);
    setError(null);
    try {
      const board = await api.createBoardFromParentTask(task.gid);
      boardsRequestRef.current += 1;
      const nextBoards = await api.getBoards();
      setBoards(sortBoardsWithStarFirst(nextBoards));
      setShowPicker(false);
      setTaskSearch("");
      setTaskResults([]);
      navigate(`/boards?boardId=${board.id}`);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The selected parent task could not be added.");
    } finally {
      setSavingTaskGid(null);
    }
  }

  async function starBoard(boardId: string) {
    setStarringBoardId(boardId);
    setError(null);
    try {
      const starredBoard = await api.starBoard(boardId);
      setBoards((current) => sortBoardsWithStarFirst(
        current.map((board) => ({
          ...board,
          isStarred: board.id === starredBoard.id
        }))
      ));
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The default work item could not be updated.");
    } finally {
      setStarringBoardId(null);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background-alt">
      <div className="z-30 flex shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface/90 px-3 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl sm:px-gutter sm:py-stack-sm">
        <div className="flex items-center gap-stack-sm">
          <span className="font-headline-md text-headline-md font-semibold text-on-surface">Work Items</span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            className="h-9 w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest px-stack-sm text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-[32px] sm:min-w-56"
            placeholder="Search selected parent tasks..."
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button
            className="h-9 rounded-xl bg-primary-container px-stack-md font-label-md text-label-md text-on-primary transition-colors hover:bg-inverse-surface disabled:cursor-not-allowed disabled:opacity-60 sm:h-[32px]"
            disabled={!canEditBoards}
            onClick={() => setShowPicker(true)}
            type="button"
          >
            New Item
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-surface">
        {!canEditBoards ? (
          <div className="m-margin rounded-2xl border border-outline-variant bg-surface-container-low px-4 py-3 text-body-md text-on-surface-variant">
            View-only — connect Asana in <Link className="font-medium text-primary" to="/settings?section=asana">Settings</Link> to import or update work items.
          </div>
        ) : null}
        {error ? <div className="m-margin rounded-2xl border border-error bg-error-container px-4 py-3 text-body-md text-on-error-container">{error}</div> : null}

        {!initialLoadComplete ? (
          <TableRowsSkeleton rows={6} />
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-gutter text-center">
            <span className="material-symbols-outlined mb-stack-sm text-[32px] text-outline-variant">playlist_add</span>
            <h3 className="mb-2 font-headline-md text-headline-md text-on-surface">No parent work items selected yet.</h3>
            <p className="max-w-lg text-body-md text-on-surface-variant">Use `New Item` to search Asana for a parent task. Once selected, it becomes a work item and gets its own connected board.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {items.map((board) => (
                <div
                  key={board.id}
                  className="w-full rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 text-left shadow-[var(--shadow-panel)] transition-colors hover:border-primary"
                  onClick={() => navigate(`/boards?boardId=${board.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/boards?boardId=${board.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-body-lg font-semibold leading-7 text-on-surface">{board.name}</div>
                    <button
                      aria-label={board.isStarred ? "Default work item" : "Set as default work item"}
                      className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-wait disabled:opacity-60"
                      disabled={!canEditBoards || starringBoardId === board.id || board.isStarred}
                      onClick={(event) => {
                        event.stopPropagation();
                        void starBoard(board.id);
                      }}
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {board.isStarred ? "star" : "star_outline"}
                      </span>
                    </button>
                  </div>
                  <div className="mt-1 text-body-sm text-on-surface-variant">Parent task gid: {board.asanaParentTaskGid}</div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-label-sm text-on-surface-variant">
                    <div>
                      <div className="uppercase tracking-[0.08em]">Workspace</div>
                      <div className="mt-1 normal-case">{board.workspaceName}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-[0.08em]">Project</div>
                      <div className="mt-1 normal-case">{board.projectName}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-[0.08em]">Subtasks</div>
                      <div className="mt-1">{board.cards.length}</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-[0.08em]">Updated</div>
                      <div className="mt-1">{latestBoardUpdate(board)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-[720px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-surface-container-low font-label-md text-label-md uppercase text-on-surface-variant shadow-sm">
                <tr>
                  <th className="border-b border-outline-variant p-stack-sm pl-gutter font-semibold">Parent Task</th>
                  <th className="border-b border-outline-variant p-stack-sm font-semibold">Workspace</th>
                  <th className="border-b border-outline-variant p-stack-sm font-semibold">Project</th>
                  <th className="border-b border-outline-variant p-stack-sm font-semibold">Subtasks</th>
                  <th className="border-b border-outline-variant p-stack-sm font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="text-body-md text-on-surface">
                {items.map((board) => (
                  <tr key={board.id} className="group cursor-pointer border-b border-outline-variant transition-colors hover:bg-surface-container-low" onClick={() => navigate(`/boards?boardId=${board.id}`)}>
                    <td className="p-stack-sm pl-gutter">
                      <div className="flex items-center gap-2">
                        <button
                          aria-label={board.isStarred ? "Default work item" : "Set as default work item"}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface disabled:cursor-wait disabled:opacity-60"
                          disabled={!canEditBoards || starringBoardId === board.id || board.isStarred}
                          onClick={(event) => {
                            event.stopPropagation();
                            void starBoard(board.id);
                          }}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {board.isStarred ? "star" : "star_outline"}
                          </span>
                        </button>
                        <div className="font-medium transition-colors group-hover:text-primary">{board.name}</div>
                      </div>
                      <div className="font-label-sm text-label-sm text-on-surface-variant">Parent task gid: {board.asanaParentTaskGid}</div>
                    </td>
                    <td className="p-stack-sm text-on-surface-variant">{board.workspaceName}</td>
                    <td className="p-stack-sm text-on-surface-variant">{board.projectName}</td>
                    <td className="p-stack-sm">
                      <span className="inline-flex items-center rounded bg-surface-container px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">{board.cards.length}</span>
                    </td>
                    <td className="p-stack-sm font-label-sm text-label-sm text-on-surface-variant">{latestBoardUpdate(board)}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {showPicker ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklch,var(--color-ink)_26%,transparent)] px-3 py-3 backdrop-blur-sm sm:items-center sm:px-gutter">
          <div className="max-h-full w-full max-w-3xl overflow-hidden rounded-3xl border border-outline-variant bg-surface shadow-[var(--shadow-popover)]">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-6">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface">Select parent task</h2>
                <p className="mt-1 text-body-md text-on-surface-variant">Search Asana for the parent task that should own this board.</p>
              </div>
              <button className="rounded-xl p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low" onClick={() => setShowPicker(false)} type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-4 sm:p-6">
              <input
                className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                placeholder="Search parent task by name..."
                type="text"
                value={taskSearch}
                onChange={(event) => setTaskSearch(event.target.value)}
              />

              <div className="mt-4 max-h-[420px] overflow-y-auto rounded-2xl border border-outline-variant">
                {pickerLoading ? (
                  <InlineLoadingHint className="px-4 py-6" label="Searching Asana tasks" />
                ) : taskSearch.trim().length < 2 ? (
                  <div className="px-4 py-6 text-body-md text-on-surface-variant">Type at least 2 characters to search parent tasks.</div>
                ) : taskResults.length === 0 ? (
                  <div className="px-4 py-6 text-body-md text-on-surface-variant">No matching parent tasks were found.</div>
                ) : (
                  <div className="divide-y divide-outline-variant">
                    {taskResults.map((task) => (
                      <button
                        key={task.gid}
                        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-container-low"
                        onClick={() => void addParentTask(task)}
                        type="button"
                        disabled={savingTaskGid === task.gid}
                      >
                        <div>
                          <div className="font-medium text-on-surface">{task.name}</div>
                          <div className="mt-1 font-label-sm text-label-sm text-on-surface-variant">
                            {task.workspaceName}
                            {task.projectName ? ` • ${task.projectName}` : ""}
                          </div>
                        </div>
                        <span className="inline-flex min-w-[4.5rem] justify-end font-label-sm text-label-sm text-on-surface-variant">
                          {savingTaskGid === task.gid ? (
                            <BusyButtonLabel busy busyLabel="Adding">
                              Open
                            </BusyButtonLabel>
                          ) : task.completed ? (
                            "Completed"
                          ) : (
                            "Open"
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function latestBoardUpdate(board: BoardSummary) {
  const latestUpdatedAt = latestBoardUpdatedAt(board);
  if (!latestUpdatedAt) {
    return "No subtasks yet";
  }

  return new Date(latestUpdatedAt).toLocaleString();
}

function sortBoardsWithStarFirst(boards: BoardSummary[]) {
  return [...boards].sort((left, right) => {
    if (left.isStarred !== right.isStarred) {
      return left.isStarred ? -1 : 1;
    }

    return (latestBoardUpdatedAt(right) ?? 0) - (latestBoardUpdatedAt(left) ?? 0);
  });
}

function latestBoardUpdatedAt(board: BoardSummary) {
  if (board.cards.length === 0) {
    return null;
  }

  return board.cards.reduce((latest, card) => {
    const timestamp = Date.parse(card.updatedAt);
    return Number.isNaN(timestamp) ? latest : Math.max(latest, timestamp);
  }, 0);
}
