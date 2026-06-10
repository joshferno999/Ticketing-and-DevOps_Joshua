import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { BoardCard, CardComment, WorkspaceUserSummary } from "@emergence-devops/shared";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../lib/api";
import { AsanaRichText } from "../../lib/asana-rich-text";
import { BusyButtonLabel } from "../ui/loading";
import { ProfileAvatar } from "../ui/profile-avatar";

interface PendingMention {
  appUserId: string;
  start: number;
  length: number;
}

interface CardCommentsSectionProps {
  boardId: string;
  card: BoardCard;
  workspaceUsers: WorkspaceUserSummary[];
}

export function CardCommentsSection({ boardId, card, workspaceUsers }: CardCommentsSectionProps) {
  const [comments, setComments] = useState<CardComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<PendingMention[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const gidToDisplayName = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of workspaceUsers) {
      if (user.asanaUserGid) {
        map.set(user.asanaUserGid, user.displayName);
      }
    }
    return map;
  }, [workspaceUsers]);

  const usersById = useMemo(() => {
    const map = new Map<string, WorkspaceUserSummary>();
    for (const user of workspaceUsers) {
      map.set(user.id, user);
    }
    return map;
  }, [workspaceUsers]);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) {
      return [];
    }

    const normalized = mentionQuery.trim().toLowerCase();
    return workspaceUsers
      .filter((user) => {
        if (!normalized) {
          return true;
        }

        return user.displayName.toLowerCase().includes(normalized)
          || user.email.toLowerCase().includes(normalized);
      })
      .slice(0, 8);
  }, [mentionQuery, workspaceUsers]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void api.listCardComments(boardId, card.id)
      .then((items) => {
        if (!cancelled) {
          setComments(items);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setLoadError(cause instanceof ApiError ? cause.message : "Comments could not be loaded.");
          setComments([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, card.id]);

  function updateMentionQuery(nextBody: string, cursor: number) {
    const prefix = nextBody.slice(0, cursor);
    const match = prefix.match(/(^|\s)@([^\s@]*)$/);
    if (!match) {
      setMentionQuery(null);
      return;
    }

    setMentionQuery(match[2] ?? "");
  }

  function handleBodyChange(nextBody: string) {
    setBody(nextBody);
    const cursor = textareaRef.current?.selectionStart ?? nextBody.length;
    updateMentionQuery(nextBody, cursor);

    setMentions((current) =>
      current.filter((mention) => {
        const segment = nextBody.slice(mention.start, mention.start + mention.length);
        return segment.length > 0;
      })
    );
  }

  function insertMention(user: WorkspaceUserSummary) {
    const textarea = textareaRef.current;
    if (!textarea || !user.mentionable) {
      return;
    }

    const cursor = textarea.selectionStart;
    const prefix = body.slice(0, cursor);
    const suffix = body.slice(cursor);
    const match = prefix.match(/(^|\s)@([^\s@]*)$/);
    if (!match) {
      return;
    }

    const mentionStart = prefix.length - (match[2]?.length ?? 0) - 1;
    const mentionLabel = `@${user.displayName} `;
    const nextBody = `${body.slice(0, mentionStart)}${mentionLabel}${suffix}`;
    const nextMention: PendingMention = {
      appUserId: user.id,
      start: mentionStart,
      length: mentionLabel.trimEnd().length
    };

    const shiftedMentions = mentions
      .filter((mention) => mention.start < mentionStart)
      .map((mention) => mention);

    const delta = mentionLabel.length - (cursor - mentionStart);
    const adjustedMentions = mentions
      .filter((mention) => mention.start >= cursor)
      .map((mention) => ({
        ...mention,
        start: mention.start + delta
      }));

    setBody(nextBody);
    setMentions([...shiftedMentions, nextMention, ...adjustedMentions]);
    setMentionQuery(null);

    requestAnimationFrame(() => {
      const nextCursor = mentionStart + mentionLabel.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || submitting) {
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const created = await api.createCardComment(boardId, card.id, {
        body: body.trim(),
        mentions
      });
      setComments((current) => [...current, created]);
      setBody("");
      setMentions([]);
      setMentionQuery(null);
    } catch (cause) {
      setSubmitError(cause instanceof ApiError ? cause.message : "Comment could not be posted.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <span className="mb-3 block border-b border-outline-variant pb-1 font-label-sm text-label-sm uppercase tracking-[0.08em] text-on-surface">
        Comments
      </span>

      {loading ? (
        <p className="text-body-md text-on-surface-variant">Loading comments…</p>
      ) : loadError ? (
        <p className="text-body-md text-error">{loadError}</p>
      ) : comments.length === 0 ? (
        <p className="mb-4 text-body-md text-on-surface-variant">No comments yet.</p>
      ) : (
        <div className="mb-4 space-y-4">
          {comments.map((comment) => (
            <article key={comment.id} className="rounded-2xl border border-outline-variant bg-surface-container-low p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ProfileAvatar
                    alt={`${comment.authorName} profile`}
                    avatarUrl={comment.authorAppUserId ? usersById.get(comment.authorAppUserId)?.avatarUrl : undefined}
                    className="h-7 w-7 border border-outline-variant bg-surface-container-highest"
                    iconClassName="text-[14px] text-on-surface-variant"
                  />
                  <span className="font-label-md text-label-md text-on-surface">{comment.authorName}</span>
                </div>
                <span className="font-label-sm text-label-sm text-on-surface-variant">{formatRelativeTime(comment.createdAt)}</span>
              </div>
              <AsanaRichText htmlText={comment.htmlText} mentions={comment.mentions} gidToDisplayName={gidToDisplayName} />
            </article>
          ))}
        </div>
      )}

      <form className="relative space-y-2" onSubmit={(event) => void handleSubmit(event)}>
        <textarea
          ref={textareaRef}
          className="min-h-[88px] w-full rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-body-md text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-focus)_18%,transparent)] disabled:cursor-wait disabled:opacity-60"
          disabled={submitting}
          placeholder="Add a comment. Type @ to mention a teammate."
          value={body}
          onChange={(event) => handleBodyChange(event.target.value)}
          onClick={(event) => updateMentionQuery(body, event.currentTarget.selectionStart)}
          onKeyUp={(event) => updateMentionQuery(body, event.currentTarget.selectionStart)}
        />

        {mentionQuery !== null && mentionCandidates.length > 0 ? (
          <div className="absolute bottom-[calc(100%+4px)] left-0 z-10 max-h-48 w-full overflow-y-auto rounded-2xl border border-outline-variant bg-surface shadow-[var(--shadow-popover)]">
            {mentionCandidates.map((user) => (
              <button
                key={user.id}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-body-md hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!user.mentionable}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  insertMention(user);
                }}
              >
                <span className="text-on-surface">{user.displayName}</span>
                <span className="text-label-sm text-on-surface-variant">
                  {user.mentionable ? user.email : "Asana not connected"}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {submitError ? (
          <p className="text-body-md text-error">
            {submitError}
            {submitError.includes("Connect Asana") ? (
              <>
                {" "}
                <Link className="text-primary underline" to="/settings?section=asana">
                  Open settings
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <div className="flex justify-end">
          <button
            className="rounded-xl border border-transparent bg-primary-container px-margin py-stack-sm font-label-md text-label-md text-on-primary disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting || !body.trim()}
            type="submit"
          >
            <BusyButtonLabel busy={submitting} busyLabel="Posting">
              Post comment
            </BusyButtonLabel>
          </button>
        </div>
      </form>
    </div>
  );
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const deltaMs = Date.now() - date.getTime();
  const minutes = Math.round(deltaMs / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
