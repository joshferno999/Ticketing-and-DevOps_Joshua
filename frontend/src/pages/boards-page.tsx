import { DragEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BoardCard, BoardSummary, WorkspaceUserSummary } from "@emergence-devops/shared";
import { api, ApiError } from "../lib/api";
import { useSession } from "../hooks/use-session";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useWorkspaceCapabilities } from "../hooks/use-workspace-capabilities";
import { BoardPageSkeleton, BusyButtonLabel } from "../components/ui/loading";
import { BoardAssigneeFilter } from "../components/boards/board-assignee-filter";
import { CardCommentsSection } from "../components/boards/card-comments-section";
import { ProfileAvatar } from "../components/ui/profile-avatar";
import { canDropIntoColumn, columnBehaviorLabel, requiresDueDate } from "../lib/board-move-rules";
import {
  buildAssigneeFilterOptions,
  filterAndSortBoardCards,
  type BoardCardSortKey
} from "../lib/board-card-view";

export function BoardsPage() {
  const { loading, user } = useSession();
  const { capabilities } = useWorkspaceCapabilities();
  const canEditBoards = capabilities.canEditBoards;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [assigneeFilterKeys, setAssigneeFilterKeys] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<BoardCardSortKey>("default");
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserSummary[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [createAtBoardLevel, setCreateAtBoardLevel] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragTargetColumnKey, setDragTargetColumnKey] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{ cardId: string; targetColumnKey: string } | null>(null);
  const [columnPickerCardId, setColumnPickerCardId] = useState<string | null>(null);
  const [moveDueOn, setMoveDueOn] = useState("");
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const boardsRequestRef = useRef(0);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    void refreshBoards();
  }, [loading, user]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    let cancelled = false;
    void api.listWorkspaceUsers()
      .then((users) => {
        if (!cancelled) {
          setWorkspaceUsers(users);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceUsers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loading, user]);

  async function refreshBoards() {
    const requestId = boardsRequestRef.current + 1;
    boardsRequestRef.current = requestId;

    try {
      const nextBoards = await api.getBoards();
      if (boardsRequestRef.current !== requestId) {
        return nextBoards;
      }

      setBoards(nextBoards);
      return nextBoards;
    } catch (cause) {
      if (boardsRequestRef.current === requestId) {
        setError(cause instanceof ApiError ? cause.message : "Board workspace could not be loaded.");
      }
      return [];
    } finally {
      if (boardsRequestRef.current === requestId) {
        setInitialLoadComplete(true);
      }
    }
  }

  const currentBoardId = searchParams.get("boardId");
  const targetCardId = searchParams.get("cardId");
  const board = useMemo(() => {
    if (boards.length === 0) {
      return null;
    }

    const starredBoard = boards.find((item) => item.isStarred) ?? boards[0];

    if (!currentBoardId) {
      return starredBoard;
    }

    return boards.find((item) => item.id === currentBoardId) ?? starredBoard;
  }, [boards, currentBoardId]);

  useEffect(() => {
    setAssigneeFilterKeys(new Set());
    setSortKey("default");
  }, [currentBoardId]);

  const assigneeFilterOptions = useMemo(() => {
    if (!board) {
      return [];
    }

    return buildAssigneeFilterOptions(board.cards, workspaceUsers);
  }, [board, workspaceUsers]);

  const filteredCards = useMemo(() => {
    if (!board) {
      return [];
    }

    return filterAndSortBoardCards({
      cards: board.cards,
      textQuery: filterQuery,
      assigneeFilterKeys,
      sortKey
    });
  }, [board, filterQuery, assigneeFilterKeys, sortKey]);

  const hasActiveViewFilters = filterQuery.trim().length > 0 || assigneeFilterKeys.size > 0;

  const cardsByTaskGid = useMemo(
    () => new Map((board?.cards ?? []).map((card) => [card.asanaTaskGid, card])),
    [board]
  );

  const workspaceUsersById = useMemo(
    () => new Map(workspaceUsers.map((workspaceUser) => [workspaceUser.id, workspaceUser])),
    [workspaceUsers]
  );

  const columns = useMemo(
    () =>
      (board?.columns ?? []).map((column) => ({
        ...column,
        cards: filteredCards.filter((card) => card.status === column.key)
      })),
    [board, filteredCards]
  );

  const selectedCard = useMemo(() => {
    if (!board || !selectedCardId) {
      return null;
    }

    return board.cards.find((card) => card.id === selectedCardId) ?? null;
  }, [board, selectedCardId]);

  const draggingCard = useMemo(() => {
    if (!board || !draggingCardId) {
      return null;
    }

    return board.cards.find((card) => card.id === draggingCardId) ?? null;
  }, [board, draggingCardId]);

  useEffect(() => {
    if (!board || !targetCardId) {
      return;
    }

    const card = board.cards.find((item) => item.id === targetCardId);
    if (!card) {
      return;
    }

    setSelectedCardId(card.id);
    setInspectorOpen(true);
  }, [board, targetCardId]);

  if (!loading && !user) {
    return null;
  }

  if (!initialLoadComplete) {
    return <BoardPageSkeleton />;
  }

  if (!board) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-gutter text-center">
        <span className="material-symbols-outlined mb-stack-sm text-[32px] text-outline-variant">view_kanban</span>
        <h2 className="mb-2 font-headline-md text-headline-md text-on-surface">No boards yet.</h2>
        <p className="max-w-xl text-body-md text-on-surface-variant">Select a parent Asana task from Work Items to create its board and start syncing subtasks here.</p>
        <button className="mt-4 rounded bg-primary px-4 py-2 text-on-primary transition-opacity hover:opacity-90" onClick={() => navigate("/work-items")} type="button">
          Open Work Items
        </button>
      </div>
    );
  }

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEditBoards || !board || !draftTitle.trim()) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const boardId = board.id;
      const parentTaskGid = createAtBoardLevel ? board.asanaParentTaskGid : (selectedCard?.asanaTaskGid ?? board.asanaParentTaskGid);
      const createdCard = await api.createBoardCard(boardId, {
        title: draftTitle.trim(),
        description: draftDescription.trim() || undefined,
        parentTaskGid
      });

      setBoards((current) =>
        current.map((item) =>
          item.id === boardId
            ? { ...item, cards: [createdCard, ...item.cards] }
            : item
        )
      );
      setSelectedCardId(createdCard.id);
      setInspectorOpen(true);
      setDraftTitle("");
      setDraftDescription("");
      setCreateAtBoardLevel(false);
      setComposerOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The Asana subtask could not be created.");
    } finally {
      setSubmitting(false);
    }
  }

  async function syncCurrentBoard() {
    if (!canEditBoards || !board) {
      return;
    }

    setSyncing(true);
    setError(null);
    try {
      const syncedBoard = await api.syncBoard(board.id);
      setBoards((current) =>
        current.map((item) => (item.id === syncedBoard.id ? syncedBoard : item))
      );
      setSelectedCardId((current) => {
        if (!current) {
          return syncedBoard.cards[0]?.id ?? null;
        }

        return syncedBoard.cards.some((card) => card.id === current)
          ? current
          : syncedBoard.cards[0]?.id ?? null;
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The board could not be synced from Asana.");
    } finally {
      setSyncing(false);
    }
  }

  function openBoardSelection(nextBoardId: string) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("boardId", nextBoardId);
    nextParams.delete("cardId");
    setSearchParams(nextParams, { replace: true });
    setSelectedCardId(null);
    setInspectorOpen(false);
  }

  function selectCard(cardId: string) {
    setSelectedCardId(cardId);
    setCreateAtBoardLevel(false);
    setInspectorOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    if (board) {
      nextParams.set("boardId", board.id);
    }
    nextParams.set("cardId", cardId);
    setSearchParams(nextParams, { replace: true });
  }

  function closeInspector() {
    setInspectorOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("cardId");
    setSearchParams(nextParams, { replace: true });
  }

  function updateBoardCard(nextCard: BoardCard) {
    setBoards((current) =>
      current.map((item) =>
        item.id === nextCard.boardId
          ? {
              ...item,
              cards: item.cards.map((card) => (card.id === nextCard.id ? nextCard : card))
            }
          : item
      )
    );
  }

  async function moveCard(cardId: string, targetColumnKey: string, dueOn?: string) {
    if (!canEditBoards || !board) {
      return;
    }

    setMoveSubmitting(true);
    setError(null);

    try {
      const updatedCard = await api.moveBoardCard(board.id, cardId, {
        dueOn,
        targetColumnKey
      });
      updateBoardCard(updatedCard);
      if (selectedCardId === updatedCard.id) {
        setSelectedCardId(updatedCard.id);
      }
      setColumnPickerCardId(null);
      setPendingMove(null);
      setMoveDueOn("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "The card could not be moved.");
    } finally {
      setMoveSubmitting(false);
      setDragTargetColumnKey(null);
      setDraggingCardId(null);
    }
  }

  function handleCardDragStart(cardId: string) {
    if (!canEditBoards) {
      return;
    }

    setDraggingCardId(cardId);
    setDragTargetColumnKey(null);
  }

  function handleCardDragEnd() {
    setDraggingCardId(null);
    setDragTargetColumnKey(null);
  }

  function handleColumnDragOver(event: DragEvent<HTMLDivElement>, columnKey: string) {
    if (!canEditBoards || !draggingCard || !canDropIntoColumn(columnKey, draggingCard)) {
      return;
    }

    event.preventDefault();
    if (dragTargetColumnKey !== columnKey) {
      setDragTargetColumnKey(columnKey);
    }
  }

  function handleColumnDrop(columnKey: string) {
    if (!canEditBoards || !draggingCard || !canDropIntoColumn(columnKey, draggingCard)) {
      return;
    }

    if (requiresDueDate(columnKey)) {
      setPendingMove({ cardId: draggingCard.id, targetColumnKey: columnKey });
      setMoveDueOn("");
      return;
    }

    void moveCard(draggingCard.id, columnKey);
  }

  function openColumnPicker(cardId: string) {
    if (!canEditBoards) {
      return;
    }

    setColumnPickerCardId(cardId);
  }

  function closeColumnPicker() {
    if (moveSubmitting) {
      return;
    }

    setColumnPickerCardId(null);
  }

  function submitTouchMove(cardId: string, targetColumnKey: string) {
    const card = board?.cards.find((item) => item.id === cardId);
    if (!card || !canDropIntoColumn(targetColumnKey, card)) {
      return;
    }

    if (requiresDueDate(targetColumnKey)) {
      setColumnPickerCardId(null);
      setPendingMove({ cardId, targetColumnKey });
      setMoveDueOn("");
      return;
    }

    void moveCard(cardId, targetColumnKey);
  }

  async function submitPendingMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingMove || !moveDueOn) {
      return;
    }

    await moveCard(pendingMove.cardId, pendingMove.targetColumnKey, moveDueOn);
  }

  function cancelPendingMove() {
    if (moveSubmitting) {
      return;
    }

    setPendingMove(null);
    setMoveDueOn("");
    setDragTargetColumnKey(null);
    setDraggingCardId(null);
  }

  return (
    <div className="relative flex h-full min-h-0 overflow-hidden bg-[linear-gradient(180deg,var(--surface)_0%,var(--background-alt)_100%)]">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="z-30 flex w-full flex-shrink-0 flex-col gap-3 border-b border-outline-variant bg-surface/90 px-3 py-3 shadow-[0_1px_0_color-mix(in_oklch,var(--color-ink)_4%,transparent)] backdrop-blur-xl sm:px-5 sm:py-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-2.5">
              <button className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl text-on-surface transition-colors duration-150 hover:bg-surface-container-low" onClick={() => navigate("/work-items")} type="button">
                <span className="material-symbols-outlined">arrow_back</span>
              </button>
              <div className="min-w-0">
                <h1 className="max-w-3xl text-balance text-[clamp(1.45rem,2vw,1.95rem)] font-semibold leading-tight tracking-[-0.02em] text-on-surface">
                  {board.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
                    {board.projectName}
                  </span>
                  <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
                    {hasActiveViewFilters ? `${filteredCards.length} of ${board.cards.length}` : board.cards.length} subtasks
                  </span>
                  <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
                    {columns.filter((column) => column.cards.length > 0).length} active columns
                  </span>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:w-auto xl:justify-end">
              <select
                className="h-9 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-9 sm:min-w-[210px] xl:max-w-[280px] xl:flex-none"
                value={board.id}
                onChange={(event) => openBoardSelection(event.target.value)}
              >
                {boards.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <BoardAssigneeFilter
                options={assigneeFilterOptions}
                selectedKeys={assigneeFilterKeys}
                onChange={setAssigneeFilterKeys}
              />
              <select
                className="h-9 min-w-0 flex-1 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-9 sm:min-w-[190px] xl:max-w-[220px] xl:flex-none"
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as BoardCardSortKey)}
              >
                <option value="default">Sort: Default</option>
                <option value="created_desc">Sort: Created (newest)</option>
                <option value="created_asc">Sort: Created (oldest)</option>
              </select>
              <div className="relative min-w-0 flex-1 xl:max-w-[260px] xl:flex-none">
                <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-on-surface-variant">search</span>
                <input
                  className="h-9 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-3 text-body-md text-on-surface shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                  placeholder="Search subtasks"
                  type="text"
                  value={filterQuery}
                  onChange={(event) => setFilterQuery(event.target.value)}
                />
              </div>
              <button
                className="flex h-9 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 font-label-md text-label-md text-on-surface shadow-sm transition-colors duration-150 hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60 sm:h-9"
                onClick={() => void syncCurrentBoard()}
                type="button"
                disabled={syncing || !canEditBoards}
              >
                <span className={`material-symbols-outlined mr-1 text-[14px] ${syncing ? "animate-spin" : ""}`}>sync</span>
                <BusyButtonLabel busy={syncing} busyLabel="Syncing">
                  Sync from Asana
                </BusyButtonLabel>
              </button>
              <button
                className="flex h-9 items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 font-label-md text-label-md text-on-surface shadow-sm transition-colors duration-150 hover:bg-surface-container-low sm:h-9"
                onClick={() => setInspectorOpen((current) => !current)}
                type="button"
                disabled={!selectedCard}
              >
                <span className="material-symbols-outlined mr-1 text-[14px]">dock_to_right</span>
                {inspectorOpen ? "Hide Details" : "Show Details"}
              </button>
              <button className="flex h-9 items-center justify-center rounded-xl bg-primary-container px-4 font-label-md text-label-md text-on-primary shadow-sm transition-colors duration-150 hover:bg-inverse-surface disabled:cursor-not-allowed disabled:opacity-60 sm:h-9" disabled={!canEditBoards} onClick={() => setComposerOpen((current) => !current)} type="button">
                <span className="material-symbols-outlined mr-1 text-[14px]">add</span>
                New Item
              </button>
            </div>
          </div>
        </div>

        {error ? <div className="border-b border-outline-variant bg-error-container px-gutter py-3 text-body-md text-on-error-container">{error}</div> : null}
        {!canEditBoards ? (
          <div className="border-b border-outline-variant bg-surface-container-low px-gutter py-3 text-body-md text-on-surface-variant">
            View-only — connect Asana in <Link className="font-medium text-primary" to="/settings?section=asana">Settings</Link> to import, sync, or move cards.
          </div>
        ) : null}

        {composerOpen && canEditBoards ? (
          <form className="border-b border-outline-variant bg-surface-container-low px-4 py-3 sm:px-5" onSubmit={submitDraft}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Create under</span>
              <button
                className={
                  createAtBoardLevel || !selectedCard
                    ? "rounded-full border border-primary bg-primary-fixed px-3 py-1 font-label-sm text-label-sm text-on-primary-fixed-variant"
                    : "rounded-full border border-outline-variant bg-surface px-3 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
                }
                onClick={() => setCreateAtBoardLevel(true)}
                type="button"
              >
                Parent task
              </button>
              <button
                className={
                  selectedCard && !createAtBoardLevel
                    ? "rounded-full border border-primary bg-primary-fixed px-3 py-1 font-label-sm text-label-sm text-on-primary-fixed-variant"
                    : "rounded-full border border-outline-variant bg-surface px-3 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                }
                onClick={() => setCreateAtBoardLevel(false)}
                type="button"
                disabled={!selectedCard}
              >
                {selectedCard ? `Selected card: ${selectedCard.title}` : "Selected card"}
              </button>
              {selectedCard && !createAtBoardLevel ? (
                <button
                  className="rounded-full border border-outline-variant bg-surface px-3 py-1 font-label-sm text-label-sm text-on-surface-variant transition-colors hover:bg-surface-container-high"
                  onClick={() => setCreateAtBoardLevel(true)}
                  type="button"
                >
                  Remove card tagging
                </button>
              ) : null}
            </div>
            <div className="grid gap-2.5 xl:grid-cols-[1.2fr_1.6fr_auto]">
              <input
                className="h-10 rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-9"
                placeholder="New Asana subtask title"
                value={draftTitle}
                onChange={(event) => setDraftTitle(event.target.value)}
              />
              <input
                className="h-10 rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-9"
                placeholder="Optional description"
                value={draftDescription}
                onChange={(event) => setDraftDescription(event.target.value)}
              />
              <div className="flex gap-2">
                  <button className="h-10 rounded-xl border border-outline-variant bg-surface px-3.5 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-high sm:h-9" onClick={() => setComposerOpen(false)} type="button">
                  Cancel
                </button>
                <button className="h-10 rounded-xl bg-primary-container px-3.5 font-label-md text-label-md text-on-primary transition-colors hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-60 sm:h-9" type="submit" disabled={submitting}>
                  <BusyButtonLabel busy={submitting} busyLabel="Creating">
                    Create in Asana
                  </BusyButtonLabel>
                </button>
              </div>
            </div>
            <p className="mt-2 text-label-md text-on-surface-variant">
              Creating under <span className="font-medium text-on-surface">{createAtBoardLevel || !selectedCard ? board.name : selectedCard.title}</span>
            </p>
          </form>
        ) : null}

        <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden p-2.5 sm:p-4">
          <div className="enterprise-scrollbar flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden px-0.5 pb-1 xl:grid xl:grid-cols-5 xl:gap-3 xl:overflow-x-hidden xl:px-0">
            {columns.map((column) => (
              <div
                key={column.id}
                className={
                  dragTargetColumnKey === column.key && draggingCard && canDropIntoColumn(column.key, draggingCard)
                    ? "flex h-full min-h-0 w-[calc(100vw-1.75rem)] min-w-[18rem] snap-center flex-shrink-0 flex-col rounded-2xl border border-primary bg-surface-container-low shadow-[var(--shadow-panel)] sm:w-[min(82vw,21rem)] lg:w-[17rem] xl:min-w-0 xl:w-auto"
                    : "flex h-full min-h-0 w-[calc(100vw-1.75rem)] min-w-[18rem] snap-center flex-shrink-0 flex-col rounded-2xl border border-outline-variant bg-surface-container-low shadow-[var(--shadow-panel)] sm:w-[min(82vw,21rem)] lg:w-[17rem] xl:min-w-0 xl:w-auto"
                }
                onDragOver={(event) => handleColumnDragOver(event, column.key)}
                onDragLeave={() => {
                  if (dragTargetColumnKey === column.key) {
                    setDragTargetColumnKey(null);
                  }
                }}
                onDrop={() => handleColumnDrop(column.key)}
              >
                <div className="flex flex-shrink-0 items-center justify-between rounded-t-2xl border-b border-outline-variant bg-surface-container-lowest px-3 py-2">
                  <div>
                    <h2 className="font-label-md text-label-md uppercase tracking-[0.12em] text-on-surface">{column.name}</h2>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-on-surface-variant">{columnBehaviorLabel(column.key)}</p>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 font-label-sm text-label-sm text-on-surface-variant">{column.cards.length}</span>
                </div>
                  <div className="enterprise-scrollbar flex flex-1 flex-col gap-2.5 overflow-y-auto p-2.5">
                    {column.cards.length === 0 ? (
                      <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-lowest px-4 text-center text-on-surface-variant sm:min-h-[180px]">
                        <span className="material-symbols-outlined mb-2 text-[24px] opacity-50">done_all</span>
                        <p className="text-body-md font-medium">No subtasks in {column.name}</p>
                      </div>
                    ) : (
                      column.cards.map((card) => (
                      <button
                        key={card.id}
                        draggable={canEditBoards}
                        className={
                          card.id === selectedCard?.id
                            ? "relative rounded-2xl border border-primary border-l-[3px] border-l-primary bg-surface p-3 text-left shadow-[var(--shadow-panel)] ring-1 ring-primary"
                            : moveSubmitting && draggingCardId === card.id
                              ? "relative rounded-2xl border border-outline-variant bg-surface p-3 text-left opacity-70"
                              : "relative rounded-2xl border border-outline-variant bg-surface p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-panel)]"
                        }
                        onClick={() => selectCard(card.id)}
                        onDragStart={() => handleCardDragStart(card.id)}
                        onDragEnd={handleCardDragEnd}
                        type="button"
                      >
                        <div className="mb-2 flex items-start justify-between gap-2.5" style={{ paddingLeft: `${Math.min(card.nestingDepth, 4) * 10}px` }}>
                          <div className="flex items-center gap-1.5 text-on-surface-variant">
                            <span className={iconClass(card)}>{iconForCard(card)}</span>
                            <span className={`font-label-sm text-label-sm tracking-[0.04em] ${card.id === selectedCard?.id ? "text-primary" : ""}`}>#{card.asanaTaskGid.slice(-4)}</span>
                            {card.nestingDepth > 0 ? (
                            <span className="rounded-full border border-outline-variant bg-surface-container-low px-1.5 py-0.5 font-label-sm text-label-sm text-on-surface-variant">
                                L{card.nestingDepth + 1}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-1">
                            <ProfileAvatar
                              alt={`${card.assignee ?? "Unassigned"} profile`}
                              avatarUrl={card.assigneeAppUserId ? workspaceUsersById.get(card.assigneeAppUserId)?.avatarUrl : undefined}
                              className="h-6 w-6 border border-outline-variant bg-surface-container-highest"
                              iconClassName="text-[12px] text-on-surface-variant"
                            />
                            {card.assigneeNotInWorkspace ? (
                              <span className="material-symbols-outlined text-[14px] text-warning" title={`${card.assignee} is not registered in this workspace`}>
                                warning
                              </span>
                            ) : null}
                            {canEditBoards ? (
                              <button
                                className="flex h-7 w-7 items-center justify-center rounded-full border border-outline-variant bg-surface text-on-surface-variant transition-colors hover:bg-surface-container-low xl:hidden"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openColumnPicker(card.id);
                                }}
                                type="button"
                              >
                                <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <h3 className="mb-2 overflow-hidden break-words text-[15px] font-semibold leading-6 text-on-surface" style={{ paddingLeft: `${Math.min(card.nestingDepth, 4) * 10}px` }}>
                          {card.title}
                        </h3>
                        <div className="flex flex-wrap gap-1.5" style={{ paddingLeft: `${Math.min(card.nestingDepth, 4) * 10}px` }}>
                          {cardDueLabel(card) ? (
                            <span className="rounded-full border border-outline-variant bg-primary-fixed px-2 py-0.5 text-[11px] leading-4 text-on-primary-fixed-variant">
                              Due {cardDueLabel(card)}
                            </span>
                          ) : null}
                          {card.manualCompletion ? (
                            <span className="rounded-full border border-outline-variant bg-surface-container-high px-2 py-0.5 text-[11px] leading-4 text-on-surface-variant">
                              Manual
                            </span>
                          ) : null}
                          {statusMeaningLabel(card.status) ? (
                            <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[11px] leading-4 text-on-surface-variant">
                              {statusMeaningLabel(card.status)}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[11px] leading-4 text-on-surface-variant">
                            {parentLabelForCard(card, board.name, board.asanaParentTaskGid, cardsByTaskGid)}
                          </span>
                        </div>
                        {(card.activityCounts.commits > 0 || card.activityCounts.pullRequests > 0) ? (
                          <div className="mt-2 flex flex-wrap gap-1.5" style={{ paddingLeft: `${Math.min(card.nestingDepth, 4) * 10}px` }}>
                            {card.activityCounts.commits > 0 ? (
                              <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[11px] leading-4 text-on-surface-variant">
                                {card.activityCounts.commits} commit{card.activityCounts.commits === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {card.activityCounts.pullRequests > 0 ? (
                              <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-[11px] leading-4 text-on-surface-variant">
                                {card.activityCounts.pullRequests} PR{card.activityCounts.pullRequests === 1 ? "" : "s"}
                              </span>
                            ) : null}
                            {card.activityCounts.openPullRequests > 0 ? (
                              <span className="rounded-full border border-outline-variant bg-success-muted px-2 py-0.5 text-[11px] leading-4 text-success">
                                {card.activityCounts.openPullRequests} open
                              </span>
                            ) : null}
                            {card.activityCounts.completedPullRequests > 0 ? (
                              <span className="rounded-full border border-outline-variant bg-primary-fixed px-2 py-0.5 text-[11px] leading-4 text-on-primary-fixed-variant">
                                {card.activityCounts.completedPullRequests} completed
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {columnPickerCardId ? (
        <div className="absolute inset-0 z-50 flex items-end justify-center bg-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] p-3 backdrop-blur-sm sm:items-center sm:p-4" onClick={closeColumnPicker}>
          <div
            className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-5 shadow-[var(--shadow-popover)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <p className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-primary">Move Card</p>
              <h2 className="mt-2 text-[1.25rem] font-semibold leading-tight text-on-surface">
                {board.cards.find((card) => card.id === columnPickerCardId)?.title ?? "Selected card"}
              </h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Choose a destination column. This touch-friendly move flow is available on mobile and tablet widths.
              </p>
            </div>
            <div className="space-y-2">
              {columns.map((column) => {
                const card = board.cards.find((item) => item.id === columnPickerCardId);
                const canMove = card ? card.status !== column.key && canDropIntoColumn(column.key, card) : false;

                return (
                  <button
                    key={column.id}
                    className={
                      canMove
                        ? "flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-container-low"
                        : "flex w-full items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-left text-on-surface-variant opacity-60"
                    }
                    disabled={!canMove || moveSubmitting}
                    onClick={() => submitTouchMove(columnPickerCardId, column.key)}
                    type="button"
                  >
                    <span>
                      <span className="block font-body-md text-body-md font-semibold text-on-surface">{column.name}</span>
                      <span className="mt-1 block text-label-sm text-on-surface-variant">{columnBehaviorLabel(column.key)}</span>
                    </span>
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                      {canMove ? "arrow_forward" : "block"}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                className="h-10 rounded-xl border border-outline-variant bg-surface px-4 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
                onClick={closeColumnPicker}
                type="button"
                disabled={moveSubmitting}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingMove ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[color-mix(in_oklch,var(--color-ink)_24%,transparent)] px-4 backdrop-blur-sm" onClick={cancelPendingMove}>
          <form
            className="w-full max-w-md rounded-3xl border border-outline-variant bg-surface p-5 shadow-[var(--shadow-popover)]"
            onClick={(event) => event.stopPropagation()}
            onSubmit={submitPendingMove}
          >
            <div className="mb-4">
              <p className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-primary">Move To In Progress</p>
              <h2 className="mt-2 text-[1.25rem] font-semibold leading-tight text-on-surface">
                {board.cards.find((card) => card.id === pendingMove.cardId)?.title ?? "Selected card"}
              </h2>
              <p className="mt-2 text-body-md text-on-surface-variant">
                Enter a due date to continue. The task will also be assigned to your connected Asana user.
              </p>
            </div>
            <label className="mb-2 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
              Due date
            </label>
            <input
              className="h-11 w-full rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
              type="date"
              value={moveDueOn}
              onChange={(event) => setMoveDueOn(event.target.value)}
              required
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="h-10 rounded-xl border border-outline-variant bg-surface px-4 font-label-md text-label-md text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
                onClick={cancelPendingMove}
                type="button"
                disabled={moveSubmitting}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-xl bg-primary-container px-4 font-label-md text-label-md text-on-primary transition-colors hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-60"
                type="submit"
                disabled={moveSubmitting || !moveDueOn}
              >
                <BusyButtonLabel busy={moveSubmitting} busyLabel="Moving">
                  Move card
                </BusyButtonLabel>
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {selectedCard && inspectorOpen ? (
        <div className="absolute inset-0 z-40 flex items-end justify-end bg-[color-mix(in_oklch,var(--color-ink)_18%,transparent)] backdrop-blur-sm" onClick={closeInspector}>
          <aside
            className="h-[82vh] w-full max-w-[28rem] overflow-y-auto rounded-t-3xl border-l border-t border-outline-variant bg-surface shadow-[var(--shadow-popover)] sm:h-full sm:max-w-[30rem] sm:rounded-l-3xl sm:rounded-tr-none 2xl:max-w-[32rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <BoardInspector
              card={selectedCard}
              board={board}
              cardsByTaskGid={cardsByTaskGid}
              workspaceUsers={workspaceUsers}
              canEditDueDate={canEditBoards}
              canEditManualCompletion={canEditBoards}
              onCardUpdated={updateBoardCard}
              onClose={closeInspector}
            />
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function BoardInspector({
  card,
  board,
  cardsByTaskGid,
  workspaceUsers: initialWorkspaceUsers,
  canEditDueDate,
  canEditManualCompletion,
  onCardUpdated,
  onClose
}: {
  card: BoardCard;
  board: BoardSummary;
  cardsByTaskGid: Map<string, BoardCard>;
  workspaceUsers: WorkspaceUserSummary[];
  canEditDueDate: boolean;
  canEditManualCompletion: boolean;
  onCardUpdated: (nextCard: BoardCard) => void;
  onClose: () => void;
}) {
  const { user } = useSession();
  const lineage = buildCardLineage(card, board.name, board.asanaParentTaskGid, cardsByTaskGid);
  const [dueDateDraft, setDueDateDraft] = useState(card.dueOn ?? dateInputValue(card.dueAt) ?? "");
  const [savingDueDate, setSavingDueDate] = useState(false);
  const [dueDateError, setDueDateError] = useState<string | null>(null);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUserSummary[]>(initialWorkspaceUsers);
  const [assigneeDraft, setAssigneeDraft] = useState(card.assigneeAppUserId ?? "");
  const [savingAssignee, setSavingAssignee] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);
  const [manualCompletionDraft, setManualCompletionDraft] = useState(card.manualCompletion);
  const [savingManualCompletion, setSavingManualCompletion] = useState(false);
  const [manualCompletionError, setManualCompletionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.listWorkspaceUsers()
      .then((users) => {
        if (!cancelled) {
          setWorkspaceUsers(users);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceUsers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setWorkspaceUsers(initialWorkspaceUsers);
  }, [initialWorkspaceUsers]);

  const workspaceUsersById = useMemo(
    () => new Map(workspaceUsers.map((workspaceUser) => [workspaceUser.id, workspaceUser])),
    [workspaceUsers]
  );

  useEffect(() => {
    setDueDateDraft(card.dueOn ?? dateInputValue(card.dueAt) ?? "");
    setDueDateError(null);
    setSavingDueDate(false);
    setAssigneeDraft(card.assigneeAppUserId ?? "");
    setAssigneeError(null);
    setSavingAssignee(false);
    setManualCompletionDraft(card.manualCompletion);
    setManualCompletionError(null);
    setSavingManualCompletion(false);
  }, [card.id, card.dueOn, card.dueAt, card.assigneeAppUserId, card.manualCompletion]);

  async function submitManualCompletion(nextManualCompletion: boolean) {
    if (savingManualCompletion) {
      return;
    }

    setSavingManualCompletion(true);
    setManualCompletionError(null);

    try {
      const updatedCard = await api.updateBoardCardManualCompletion(card.boardId, card.id, {
        manualCompletion: nextManualCompletion
      });
      onCardUpdated(updatedCard);
    } catch (cause) {
      setManualCompletionError(
        cause instanceof ApiError ? cause.message : "The manual completion setting could not be updated."
      );
      setManualCompletionDraft(card.manualCompletion);
    } finally {
      setSavingManualCompletion(false);
    }
  }

  async function submitAssignee(nextAssigneeAppUserId: string) {
    if (savingAssignee) {
      return;
    }

    setSavingAssignee(true);
    setAssigneeError(null);

    try {
      const updatedCard = await api.updateBoardCardAssignee(card.boardId, card.id, {
        assigneeAppUserId: nextAssigneeAppUserId || null
      });
      onCardUpdated(updatedCard);
    } catch (cause) {
      setAssigneeError(cause instanceof ApiError ? cause.message : "The assignee could not be updated.");
      setAssigneeDraft(card.assigneeAppUserId ?? "");
    } finally {
      setSavingAssignee(false);
    }
  }

  async function submitDueDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueDateDraft || savingDueDate) {
      return;
    }

    setSavingDueDate(true);
    setDueDateError(null);

    try {
      const updatedCard = await api.updateBoardCardDueDate(card.boardId, card.id, {
        dueOn: dueDateDraft
      });
      onCardUpdated(updatedCard);
    } catch (cause) {
      setDueDateError(cause instanceof ApiError ? cause.message : "The due date could not be updated.");
    } finally {
      setSavingDueDate(false);
    }
  }

  return (
      <div className="flex h-full flex-col">
      <div className="flex items-start justify-between border-b border-outline-variant p-5">
        <div>
          <div className="mb-1 flex items-center gap-2 text-on-surface-variant">
            <span className={iconClass(card)}>{iconForCard(card)}</span>
            <span className="font-label-sm text-label-sm tracking-[0.04em] text-primary">#{card.asanaTaskGid.slice(-4)}</span>
          </div>
          <h2 className="font-headline-md text-headline-md tracking-[-0.02em] text-on-surface">{card.title}</h2>
        </div>
        <button className="rounded-xl p-1 text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface" onClick={onClose} type="button">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-5">
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-outline-variant bg-surface-container-low p-4 sm:grid-cols-2">
          <div>
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">State</span>
            <span className="inline-block rounded border border-primary-fixed-dim bg-primary-fixed px-2 py-1 font-label-sm text-label-sm text-on-primary-fixed-variant">
              {labelForStatus(card.status)}
            </span>
          </div>
          <div>
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Assignee</span>
            <div className="flex items-start gap-2">
              <ProfileAvatar
                alt={`${card.assignee ?? "Unassigned"} profile`}
                avatarUrl={card.assigneeAppUserId ? workspaceUsersById.get(card.assigneeAppUserId)?.avatarUrl : undefined}
                className="h-6 w-6 shrink-0 border border-outline-variant bg-surface-container-highest"
                iconClassName="text-[12px] text-on-surface-variant"
              />
              <div className="min-w-0 flex-1">
                <select
                  className="h-10 w-full rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] disabled:cursor-wait disabled:opacity-60"
                  disabled={savingAssignee}
                  value={assigneeDraft}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setAssigneeDraft(nextValue);
                    void submitAssignee(nextValue);
                  }}
                >
                  <option value="">Unassigned</option>
                  {workspaceUsers.map((workspaceUser) => (
                    <option key={workspaceUser.id} value={workspaceUser.id}>
                      {workspaceUser.displayName}
                      {user?.id === workspaceUser.id ? " (you)" : ""}
                    </option>
                  ))}
                </select>
                {card.assigneeNotInWorkspace ? (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-warning">
                    <span className="material-symbols-outlined text-[16px]" title="Assignee from Asana is not registered in this workspace">
                      warning
                    </span>
                    {card.assignee} is not in the workspace user list.
                  </p>
                ) : null}
                {assigneeError ? <p className="mt-2 text-[12px] text-error">{assigneeError}</p> : null}
              </div>
            </div>
          </div>
          <div>
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Hierarchy</span>
            <span className="text-body-md font-medium text-on-surface">Level {card.nestingDepth + 1}</span>
          </div>
          <div>
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Due</span>
            <form className="flex flex-col gap-2" onSubmit={submitDueDate}>
              <input
                className="h-10 rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
                type="date"
                value={dueDateDraft}
                onChange={(event) => setDueDateDraft(event.target.value)}
                required
                disabled={!canEditDueDate || savingDueDate}
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-on-surface-variant">{cardDueLabel(card) ?? "No due date"}</span>
                <button
                  className="h-8 rounded-xl bg-primary-container px-3 font-label-md text-label-md text-on-primary transition-colors hover:bg-inverse-surface disabled:cursor-wait disabled:opacity-60"
                  type="submit"
                  disabled={!canEditDueDate || savingDueDate || !dueDateDraft || dueDateDraft === (card.dueOn ?? dateInputValue(card.dueAt) ?? "")}
                >
                  <BusyButtonLabel busy={savingDueDate} busyLabel="Saving">
                    Save
                  </BusyButtonLabel>
                </button>
              </div>
              {dueDateError ? <p className="text-[12px] text-error">{dueDateError}</p> : null}
            </form>
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Completion</span>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-outline-variant bg-surface px-3 py-2.5">
              <input
                checked={manualCompletionDraft}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-outline-variant text-primary focus:ring-primary disabled:cursor-wait disabled:opacity-60"
                disabled={!canEditManualCompletion || savingManualCompletion}
                type="checkbox"
                onChange={(event) => {
                  const nextValue = event.target.checked;
                  setManualCompletionDraft(nextValue);
                  void submitManualCompletion(nextValue);
                }}
              />
              <span className="min-w-0">
                <span className="block text-body-md font-medium text-on-surface">Manual</span>
                <span className="mt-0.5 block text-[12px] leading-5 text-on-surface-variant">
                  Non-coding task — can be completed without a linked PR or commit.
                </span>
              </span>
            </label>
            {manualCompletionError ? <p className="mt-2 text-[12px] text-error">{manualCompletionError}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <span className="mb-1 block font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">Path</span>
            <div className="flex flex-wrap gap-2">
              {lineage.map((item) => (
                <span key={item} className="rounded-full border border-outline-variant bg-surface px-2 py-1 font-label-sm text-label-sm text-on-surface-variant">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="mb-2 block border-b border-outline-variant pb-1 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface">Description</span>
          <p className="text-body-md leading-6 text-on-surface-variant">{card.description || "No description provided."}</p>
        </div>

        <CardCommentsSection boardId={board.id} card={card} workspaceUsers={workspaceUsers} />

        <div>
          <span className="mb-3 block border-b border-outline-variant pb-1 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface">Development Activity</span>
          {card.links.length === 0 ? (
            <p className="text-body-md leading-6 text-on-surface-variant">No GitHub activity is linked to this subtask yet.</p>
          ) : (
            <div className="space-y-5">
              {groupActivityLinks(card.links).map((group) => (
                <div key={group.label}>
                  <div className="mb-2 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">{group.label}</div>
                  <div className="ml-3 flex flex-col gap-4 border-l border-outline-variant pl-6">
                    {group.items.map((link) => (
                      <a key={link.id} className="relative block" href={link.url} target="_blank" rel="noreferrer">
                        <div className="absolute -left-[31px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-outline-variant bg-surface p-0.5 text-on-surface-variant">
                          <span className="material-symbols-outlined text-[12px]">{link.type === "pull_request" ? "merge_type" : link.type === "branch" ? "code_branch" : "commit"}</span>
                        </div>
                        <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-3 transition-colors hover:bg-surface-container-high">
                          <div className="mb-1 flex items-center justify-between gap-3">
                            <span className="text-body-md font-semibold text-on-surface">{timelineTitle(link.type)}</span>
                            <div className="flex items-center gap-2">
                              {link.type === "pull_request" && link.state ? (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${pullRequestStateClass(link.state)}`}>
                                  {link.state.toUpperCase()}
                                </span>
                              ) : null}
                              <span className="font-label-sm text-label-sm text-on-surface-variant">{relativeTime(link.authoredAt)}</span>
                            </div>
                          </div>
                          <p className="text-body-md leading-6 text-on-surface-variant">{link.title}</p>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function iconForCard(card: BoardCard) {
  if (card.status === "done") {
    return "task_alt";
  }
  if (card.status === "review") {
    return "book";
  }
  if (card.status === "not_started") {
    return "schedule";
  }
  return "assignment";
}

function iconClass(card: BoardCard) {
  const base = "material-symbols-outlined text-[14px]";
  if (card.status === "done") return `${base} text-success`;
  if (card.status === "review") return `${base} text-story-blue`;
  if (card.status === "not_started") return `${base} text-secondary`;
  return `${base} text-task-yellow`;
}

function labelForStatus(status: string) {
  if (status === "active") return "In Progress";
  if (status === "review") return "In PR";
  if (status === "done") return "Done";
  if (status === "not_started") return "Not Started";
  return "Backlog";
}

function statusMeaningLabel(status: string) {
  if (status === "not_started") return "No due date";
  if (status === "active") return "Due today or later";
  if (status === "backlog") return "Past due";
  return null;
}

function timelineTitle(type: BoardCard["links"][number]["type"]) {
  if (type === "branch") return "Branch created";
  if (type === "commit") return "Commit pushed";
  return "Pull request updated";
}

function groupActivityLinks(links: BoardCard["links"]) {
  const commits = links.filter((link) => link.type === "commit");
  const pullRequests = links.filter((link) => link.type === "pull_request");
  const branches = links.filter((link) => link.type === "branch");

  return [
    ...(pullRequests.length > 0 ? [{ label: "Pull Requests", items: pullRequests }] : []),
    ...(commits.length > 0 ? [{ label: "Commits", items: commits }] : []),
    ...(branches.length > 0 ? [{ label: "Branches", items: branches }] : [])
  ];
}

function pullRequestStateClass(state: NonNullable<BoardCard["links"][number]["state"]>) {
  if (state === "open") {
    return "bg-success-muted text-success";
  }
  if (state === "merged") {
    return "bg-primary-fixed text-on-primary-fixed-variant";
  }
  return "bg-surface-container-high text-on-surface-variant";
}

function relativeTime(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const hours = Math.max(1, Math.round(diff / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function cardDueLabel(card: BoardCard) {
  if (card.dueOn) {
    return formatDateLabel(card.dueOn);
  }

  if (card.dueAt) {
    return formatDateTimeLabel(card.dueAt);
  }

  return null;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return value;
  }

  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function formatDateTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function dateInputValue(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function parentLabelForCard(
  card: BoardCard,
  boardName: string,
  boardRootTaskGid: string,
  cardsByTaskGid: Map<string, BoardCard>
) {
  if (card.parentTaskGid === boardRootTaskGid) {
    return `Parent: ${boardName}`;
  }

  return `Parent: ${cardsByTaskGid.get(card.parentTaskGid)?.title ?? `#${card.parentTaskGid.slice(-4)}`}`;
}

function buildCardLineage(
  card: BoardCard,
  boardName: string,
  boardRootTaskGid: string,
  cardsByTaskGid: Map<string, BoardCard>
) {
  const lineage = [boardName];

  for (const ancestorGid of card.ancestryPath) {
    if (ancestorGid === boardRootTaskGid) {
      continue;
    }

    lineage.push(cardsByTaskGid.get(ancestorGid)?.title ?? `#${ancestorGid.slice(-4)}`);
  }

  lineage.push(card.title);
  return lineage;
}
