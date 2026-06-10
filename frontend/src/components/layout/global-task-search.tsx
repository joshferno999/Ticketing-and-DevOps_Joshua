import { useDeferredValue, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { TaskLinkableCardSummary } from "@emergence-devops/shared";
import { useNavigate } from "react-router-dom";
import { InlineLoadingHint, InlineSpinner } from "../ui/loading";
import { api, ApiError } from "../../lib/api";

function statusLabel(status: string) {
  if (status === "active") return "In Progress";
  if (status === "review") return "In PR";
  if (status === "done") return "Done";
  if (status === "not_started") return "Not Started";
  if (status === "backlog") return "Backlog";
  return status;
}

export function GlobalTaskSearch() {
  const navigate = useNavigate();
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<TaskLinkableCardSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const trimmedQuery = deferredQuery.trim();
  const showDropdown = dropdownOpen && trimmedQuery.length >= 2;

  useEffect(() => {
    if (trimmedQuery.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      setActiveIndex(-1);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError(null);

    void api.searchBoardTasks(trimmedQuery)
      .then((payload) => {
        if (!active) {
          return;
        }
        setResults(payload.items);
        setActiveIndex(payload.items.length > 0 ? 0 : -1);
      })
      .catch((cause) => {
        if (!active) {
          return;
        }
        setResults([]);
        setActiveIndex(-1);
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
  }, [trimmedQuery]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function openTask(task: TaskLinkableCardSummary) {
    const nextParams = new URLSearchParams();
    nextParams.set("boardId", task.boardId);
    nextParams.set("cardId", task.id);
    navigate(`/boards?${nextParams.toString()}`);
    setQuery("");
    setResults([]);
    setDropdownOpen(false);
    setActiveIndex(-1);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (activeIndex >= 0 && results[activeIndex]) {
      openTask(results[activeIndex]);
      return;
    }

    if (results[0]) {
      openTask(results[0]);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown || results.length === 0) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % results.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? results.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      openTask(results[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setDropdownOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 items-center md:ml-stack-md md:max-w-md lg:max-w-lg">
      <form className="w-full" onSubmit={handleSubmit}>
        <span className="material-symbols-outlined absolute left-3 top-1/2 z-10 -translate-y-1/2 text-[18px] text-on-surface-variant">search</span>
        {searching ? (
          <span className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
            <InlineSpinner size="xs" />
          </span>
        ) : null}
        <input
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-expanded={showDropdown}
          className="h-10 w-full min-w-0 rounded-2xl border border-outline-variant bg-surface-container-lowest/80 pl-10 pr-3 text-body-md text-on-surface shadow-[inset_0_1px_0_color-mix(in_oklch,white_72%,transparent)] placeholder:text-on-surface-variant transition-[background,border-color,box-shadow] duration-[var(--dur-short)] focus:border-primary focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)]"
          placeholder="Search tasks..."
          role="combobox"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setDropdownOpen(true);
          }}
          onFocus={() => setDropdownOpen(true)}
          onKeyDown={handleKeyDown}
        />
      </form>

      {showDropdown ? (
        <div
          className="absolute left-0 top-[calc(100%+8px)] z-[60] w-[min(26rem,90vw)] overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-[var(--shadow-popover)]"
          id={listboxId}
          role="listbox"
        >
          {searching ? (
            <InlineLoadingHint className="px-4 py-3" label="Searching tasks" />
          ) : searchError ? (
            <div className="px-4 py-3 text-body-md text-error">{searchError}</div>
          ) : results.length === 0 ? (
            <div className="px-4 py-3 text-body-md text-on-surface-variant">No matching tasks found.</div>
          ) : (
            <div className="max-h-80 overflow-y-auto py-1">
              {results.map((task, index) => (
                <button
                  key={task.id}
                  aria-selected={index === activeIndex}
                  className={
                    index === activeIndex
                      ? "flex w-full items-start justify-between gap-3 bg-surface-container-high px-4 py-3 text-left transition-colors"
                      : "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-container-low"
                  }
                  id={`${listboxId}-option-${index}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => openTask(task)}
                  role="option"
                  type="button"
                >
                  <div className="min-w-0">
                    <div className="truncate text-body-md font-medium text-on-surface">{task.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-label-sm text-on-surface-variant">
                      <span>{task.boardName}</span>
                      <span>•</span>
                      <span>#{task.asanaTaskGid.slice(-4)}</span>
                      {task.parentTitle ? (
                        <>
                          <span>•</span>
                          <span className="truncate">{task.parentTitle}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-outline-variant bg-surface-container-low px-2 py-0.5 font-label-sm text-[10px] uppercase tracking-[0.08em] text-on-surface-variant">
                    {statusLabel(task.status)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
