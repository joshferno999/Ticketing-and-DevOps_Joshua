import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardAssigneeFilterOption } from "../../lib/board-card-view";

interface BoardAssigneeFilterProps {
  options: BoardAssigneeFilterOption[];
  selectedKeys: ReadonlySet<string>;
  onChange: (nextKeys: Set<string>) => void;
}

export function BoardAssigneeFilter({ options, selectedKeys, onChange }: BoardAssigneeFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedCount = selectedKeys.size;
  const label = useMemo(() => {
    if (selectedCount === 0) {
      return "All assignees";
    }

    if (selectedCount === 1) {
      const selectedKey = Array.from(selectedKeys)[0];
      return options.find((option) => option.key === selectedKey)?.label ?? "1 assignee";
    }

    return `${selectedCount} assignees`;
  }, [options, selectedCount, selectedKeys]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  function toggleOption(key: string) {
    const nextKeys = new Set(selectedKeys);
    if (nextKeys.has(key)) {
      nextKeys.delete(key);
    } else {
      nextKeys.add(key);
    }
    onChange(nextKeys);
  }

  return (
    <div className="relative min-w-0 flex-1 sm:min-w-[210px] xl:max-w-[240px] xl:flex-none" ref={containerRef}>
      <button
        className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-on-surface shadow-sm transition-colors duration-150 hover:bg-surface-container-low sm:h-9"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px] text-on-surface-variant">group</span>
          <span className="truncate">{label}</span>
        </span>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-50 w-full min-w-[15rem] rounded-2xl border border-outline-variant bg-surface p-2 shadow-[var(--shadow-popover)]">
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface-variant">
              Filter by assignee
            </span>
            {selectedCount > 0 ? (
              <button
                className="font-label-sm text-label-sm text-primary transition-opacity hover:opacity-80"
                onClick={() => onChange(new Set())}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-[12px] text-on-surface-variant">No assignees on this board yet.</p>
            ) : (
              options.map((option) => (
                <label
                  key={option.key}
                  className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-body-md text-on-surface transition-colors hover:bg-surface-container-low"
                >
                  <input
                    checked={selectedKeys.has(option.key)}
                    className="h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                    type="checkbox"
                    onChange={() => toggleOption(option.key)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
