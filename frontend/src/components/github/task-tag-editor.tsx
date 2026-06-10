import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { TaskLinkableCardSummary } from "@emergence-devops/shared";
import { BusyButtonLabel, InlineLoadingHint } from "../ui/loading";
import { api, ApiError } from "../../lib/api";

type TaskTagEditorProps = {
  activityKey: string;
  repositoryId: string;
  title: string;
  currentTasks: TaskLinkableCardSummary[];
  loading?: boolean;
  saving?: boolean;
  error?: string | null;
  saveLabel?: string;
  onSave: (cardIds: string[]) => Promise<void>;
};

export function TaskTagEditor({
  activityKey,
  repositoryId,
  title,
  currentTasks,
  loading = false,
  saving = false,
  error = null,
  saveLabel = "Save tags",
  onSave
}: TaskTagEditorProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<TaskLinkableCardSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTasks, setSelectedTasks] = useState<TaskLinkableCardSummary[]>(currentTasks);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedTasks(currentTasks);
    setQuery("");
    setResults([]);
    setSearchError(null);
    setSaveError(null);
  }, [activityKey, currentTasks]);

  useEffect(() => {
    if (deferredQuery.trim().length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError(null);
    void api.searchRepositoryTasks(repositoryId, deferredQuery)
      .then((payload) => {
        if (!active) {
          return;
        }
        setResults(payload.items);
      })
      .catch((cause) => {
        if (!active) {
          return;
        }
        setSearchError(cause instanceof ApiError ? cause.message : "Tasks could not be searched.");
      })
      .finally(() => {
        if (active) {
          setSearching(false);
        }
      });

    return () => {
      active = false;
    };
  }, [deferredQuery, repositoryId]);

  const selectedTaskIds = useMemo(
    () => new Set(selectedTasks.map((task) => task.id)),
    [selectedTasks]
  );
  const currentTaskIds = useMemo(
    () => new Set(currentTasks.map((task) => task.id)),
    [currentTasks]
  );
  const isDirty =
    selectedTasks.length !== currentTasks.length ||
    selectedTasks.some((task) => !currentTaskIds.has(task.id));

  function addTask(task: TaskLinkableCardSummary) {
    setSelectedTasks((current) => (
      current.some((item) => item.id === task.id)
        ? current
        : [...current, task]
    ));
    setQuery("");
    setResults([]);
  }

  function removeTask(taskId: string) {
    setSelectedTasks((current) => current.filter((task) => task.id !== taskId));
  }

  async function saveTasks() {
    const selectedTaskIdsForSave = selectedTasks.map((task) => task.id);
    setSaveError(null);
    try {
      await onSave(selectedTaskIdsForSave);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Task tags could not be saved.");
    }
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-[var(--shadow-panel)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="font-label-md uppercase tracking-[0.08em] leading-5 text-on-surface-variant">{title}</div>
          <div className="mt-1 text-body-sm leading-5 text-on-surface-variant">
            Link this GitHub activity to one or more board tasks.
          </div>
        </div>
        <button
          className="inline-flex h-8 shrink-0 items-center self-start whitespace-nowrap rounded-xl border border-outline-variant bg-surface px-2.5 text-label-sm leading-none text-on-surface-variant transition-colors hover:bg-surface-container-low disabled:cursor-wait disabled:opacity-60 sm:self-auto"
          disabled={!isDirty || saving || loading}
          onClick={() => void saveTasks()}
          type="button"
        >
          <BusyButtonLabel busy={saving} busyLabel="Saving">
            {saveLabel}
          </BusyButtonLabel>
        </button>
      </div>

      <div className="mt-4">
        <input
          className="h-9 w-full rounded-xl border border-outline-variant bg-surface px-3 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
          placeholder="Search board tasks by title, gid, or board..."
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {selectedTasks.length > 0 ? selectedTasks.map((task) => (
          <span key={task.id} className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-surface px-3 py-1 text-label-sm text-on-surface">
            <span className="truncate max-w-[240px]">{task.title}</span>
            <span className="text-on-surface-variant">#{task.asanaTaskGid.slice(-4)}</span>
            <button
              className="material-symbols-outlined text-[14px] text-on-surface-variant transition-colors hover:text-on-surface"
              onClick={() => removeTask(task.id)}
              type="button"
            >
              close
            </button>
          </span>
        )) : (
          <span className="text-body-md text-on-surface-variant">No tasks tagged yet.</span>
        )}
      </div>

      {loading ? (
        <InlineLoadingHint className="mt-3" label="Loading tagged tasks" />
      ) : null}
      {error ? (
        <div className="mt-3 rounded-2xl border border-error bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {error}
        </div>
      ) : null}
      {saveError ? (
        <div className="mt-3 rounded-2xl border border-error bg-error-container px-3 py-2 text-body-md text-on-error-container">
          {saveError}
        </div>
      ) : null}

      {query.trim().length >= 2 ? (
        <div className="mt-3 rounded-2xl border border-outline-variant bg-surface">
          {searching ? (
            <InlineLoadingHint className="px-3 py-4" label="Searching tasks" />
          ) : searchError ? (
            <div className="px-3 py-4 text-body-md text-error">{searchError}</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-body-md text-on-surface-variant">No matching tasks found.</div>
          ) : (
            <div className="divide-y divide-outline-variant">
              {results.map((task) => (
                <button
                  key={task.id}
                  className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-surface-container-low disabled:opacity-60"
                  disabled={selectedTaskIds.has(task.id)}
                  onClick={() => addTask(task)}
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate text-body-md font-medium text-on-surface">{task.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
                      <span>{task.boardName}</span>
                      <span>•</span>
                      <span>#{task.asanaTaskGid.slice(-4)}</span>
                      <span>•</span>
                      <span>{task.parentTitle ?? "Parent task"}</span>
                    </div>
                  </div>
                  <span className="rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] text-on-surface-variant">
                    {selectedTaskIds.has(task.id) ? "Selected" : task.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
