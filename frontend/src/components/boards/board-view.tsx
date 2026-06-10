import { startTransition, useMemo, useState, type DragEvent } from "react";
import type { BoardCard, BoardSummary } from "@emergence-devops/shared";
import { Circle, GitBranch, GitCommitHorizontal, GitPullRequest, Plus, UserRound } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface BoardViewProps {
  board: BoardSummary;
}

export function BoardView({ board }: BoardViewProps) {
  const [cards, setCards] = useState(board.cards);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  const groupedCards = useMemo(
    () =>
      board.columns.map((column) => ({
        ...column,
        cards: cards.filter((card) => card.status === column.key)
      })),
    [board.columns, cards]
  );

  function moveCard(cardId: string, targetColumnKey: string) {
    startTransition(() => {
      setCards((currentCards) => currentCards.map((card) => (card.id === cardId ? { ...card, status: targetColumnKey } : card)));
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      {groupedCards.map((column) => (
        <section
          key={column.id}
          className="min-h-[620px] rounded-2xl border border-[var(--line)] bg-[var(--surface-container-low)] shadow-[var(--shadow-panel)]"
          onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
          onDrop={() => {
            if (draggingCardId) {
              moveCard(draggingCardId, column.key);
              setDraggingCardId(null);
            }
          }}
        >
          <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--surface-container-lowest)] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="font-label-sm text-label-sm uppercase tracking-[0.12em] text-[var(--text-muted)]">{column.name}</span>
              <span className="rounded-full border border-[var(--line)] bg-[var(--surface-muted)] px-1.5 py-0.5 font-label-sm text-label-sm text-[var(--text-soft)]">{column.cards.length}</span>
            </div>
            <button type="button" className="rounded-xl p-1 text-[var(--text-soft)] transition hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]">
              <Plus className="size-4" />
            </button>
          </header>

          <div className="enterprise-scrollbar space-y-3 overflow-y-auto p-3">
            {column.cards.map((card) => (
              <article
                key={card.id}
                draggable
                onDragStart={() => setDraggingCardId(card.id)}
                className="board-card-enter rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3 shadow-[0_1px_1px_color-mix(in_oklch,var(--color-ink)_6%,transparent)] transition hover:-translate-y-0.5 hover:border-[var(--line-strong)] hover:shadow-[var(--shadow-panel)]"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 font-label-sm text-label-sm text-[var(--text-soft)]">
                      <Circle className="size-2 fill-current stroke-none text-[var(--accent)]" />
                      <span>#{card.asanaTaskGid.slice(-4)}</span>
                    </div>
                    <h3 className="font-body-lg text-body-lg font-semibold text-[var(--text)]">{card.title}</h3>
                  </div>
                  {card.priority ? <Badge variant={priorityToVariant(card.priority)}>{card.priority}</Badge> : null}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {card.tags.map((tag) => (
                    <Badge key={tag}>{tag}</Badge>
                  ))}
                </div>

                {card.links.length > 0 ? (
                  <div className="mt-3 space-y-2 border-t border-[var(--line)] pt-3">
                    {card.links.map((link) => (
                      <div key={link.id} className="flex items-center justify-between gap-2 font-body-md text-body-md">
                        <span className="flex min-w-0 items-center gap-2 text-[var(--text-muted)]">
                          <LinkIcon type={link.type} />
                          <span className="truncate">{link.title}</span>
                        </span>
                        <a className="text-[var(--accent-strong)] hover:underline" href={link.url} target="_blank" rel="noreferrer">
                          Open
                        </a>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 font-label-sm text-label-sm text-[var(--text-soft)]">
                  <span className="flex items-center gap-1.5">
                    <UserRound className="size-3.5" />
                    {card.assignee ?? "Unassigned"}
                  </span>
                  <Button variant="ghost" size="sm">
                    Open
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function priorityToVariant(priority: BoardCard["priority"]) {
  switch (priority) {
    case "critical":
      return "danger";
    case "high":
      return "warning";
    case "medium":
      return "info";
    default:
      return "default";
  }
}

function LinkIcon({ type }: { type: BoardCard["links"][number]["type"] }) {
  if (type === "pull_request") {
    return <GitPullRequest className="size-3.5 shrink-0 text-[var(--warning)]" />;
  }

  if (type === "branch") {
    return <GitBranch className="size-3.5 shrink-0 text-[var(--accent)]" />;
  }

  return <GitCommitHorizontal className="size-3.5 shrink-0 text-[var(--success)]" />;
}
