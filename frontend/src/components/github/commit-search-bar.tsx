import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from "react";
import { createPortal } from "react-dom";
import type { RepositoryCommitNode, RepositoryCommitSearchItem } from "@emergence-devops/shared";
import { api, ApiError } from "../../lib/api";

const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function isSearchableQuery(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return false;
  }

  const withoutCaret = trimmed.startsWith("^") ? trimmed.slice(1) : trimmed;
  return trimmed.length >= 2 || SHA_PATTERN.test(withoutCaret);
}

function normalizeSearchItems(payload: unknown): RepositoryCommitSearchItem[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? items as RepositoryCommitSearchItem[] : [];
}

type DropdownPosition = {
  top: number;
  left: number;
  width: number;
};

type CommitSearchBarProps = {
  repositoryId: string;
  onSelect: (commit: RepositoryCommitNode) => void;
};

export function CommitSearchBar({ repositoryId, onSelect }: CommitSearchBarProps) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [results, setResults] = useState<RepositoryCommitSearchItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  const showDropdown = open && isSearchableQuery(query);

  function updateDropdownPosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    });
  }

  useLayoutEffect(() => {
    if (!showDropdown) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);

    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showDropdown, results.length, searching, searchError]);

  useEffect(() => {
    if (!isSearchableQuery(deferredQuery)) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      setHasSearched(false);
      setOpen(false);
      return;
    }

    let active = true;
    setSearching(true);
    setSearchError(null);
    setOpen(true);

    void api.searchRepositoryCommits(repositoryId, deferredQuery.trim())
      .then((payload) => {
        if (!active) {
          return;
        }

        const items = normalizeSearchItems(payload);
        setResults(items);
        setHasSearched(true);
        setOpen(true);
        setHighlightedIndex(0);
      })
      .catch((cause) => {
        if (!active) {
          return;
        }

        setResults([]);
        setHasSearched(true);
        setOpen(true);
        setSearchError(cause instanceof ApiError ? cause.message : "Commits could not be searched.");
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

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const activeResult = useMemo(
    () => results[highlightedIndex] ?? null,
    [highlightedIndex, results]
  );

  function selectResult(item: RepositoryCommitSearchItem) {
    onSelect(item.commit);
    setQuery("");
    setResults([]);
    setHasSearched(false);
    setOpen(false);
    setSearchError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showDropdown) {
      if (event.key === "Escape") {
        setOpen(false);
      }
      return;
    }

    if (results.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((current) => (current + 1) % results.length);
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((current) => (current - 1 + results.length) % results.length);
        return;
      }

      if (event.key === "Enter" && activeResult) {
        event.preventDefault();
        selectResult(activeResult);
        return;
      }
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const dropdownContent = showDropdown && dropdownPosition
    ? createPortal(
        <div
          ref={dropdownRef}
          className="z-[200]"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width
          }}
        >
          {searching ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-sm text-on-surface-variant shadow-[var(--shadow-popover)]">
              Searching commits...
            </div>
          ) : searchError ? (
            <div className="rounded-2xl border border-error bg-error-container px-3 py-2 text-label-sm text-on-error-container shadow-[var(--shadow-popover)]">
              {searchError}
            </div>
          ) : results.length > 0 ? (
            <ul
              className="max-h-80 overflow-auto rounded-2xl border border-outline-variant bg-surface-container-lowest py-1 shadow-[var(--shadow-popover)]"
              id={listboxId}
              role="listbox"
            >
              {results.map((item, index) => (
                <li key={item.commit.sha} role="option" aria-selected={index === highlightedIndex}>
                  <button
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                      index === highlightedIndex ? "bg-surface-container-low" : "hover:bg-surface-container-low"
                    }`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectResult(item)}
                    type="button"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-label-md text-label-md text-on-surface">{item.commit.shortSha}</span>
                      <span className="rounded-full border border-outline-variant bg-surface px-2 py-0.5 text-label-sm text-on-surface-variant">
                        {item.matchLabel}
                      </span>
                    </div>
                    <span className="truncate text-body-sm text-on-surface">{item.commit.messageHeadline}</span>
                    <span className="truncate text-label-sm text-on-surface-variant">
                      {item.commit.authorLogin ?? item.commit.authorName}
                      {item.commit.taggedTaskCount > 0 ? ` · ${item.commit.taggedTaskCount} tagged` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearched ? (
            <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-label-sm text-on-surface-variant shadow-[var(--shadow-popover)]">
              No matching commits found.
            </div>
          ) : null}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <div ref={containerRef} className="relative min-w-0 w-full flex-1 sm:min-w-[220px] sm:max-w-[360px]">
        <span className="material-symbols-outlined pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[16px] text-on-surface-variant">
          search
        </span>
        <input
          ref={inputRef}
          aria-autocomplete="list"
          aria-controls={showDropdown ? listboxId : undefined}
          aria-expanded={showDropdown}
          className="h-10 w-full rounded-xl border border-outline-variant bg-surface-container-lowest pl-8 pr-8 text-label-sm text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] sm:h-8"
          placeholder="Search commits by SHA, message, or author"
          role="combobox"
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (isSearchableQuery(event.target.value)) {
              setOpen(true);
            } else {
              setOpen(false);
              setHasSearched(false);
            }
          }}
          onFocus={() => {
            if (isSearchableQuery(query)) {
              setOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
        />
        {searching ? (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label-sm text-on-surface-variant">
            ...
          </span>
        ) : null}
      </div>
      {dropdownContent}
    </>
  );
}
