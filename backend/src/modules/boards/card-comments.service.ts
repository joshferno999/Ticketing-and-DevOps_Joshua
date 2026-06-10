import type {
  CardComment,
  CardCommentMention,
  CreateCardCommentInput
} from "@emergence-devops/shared";
import type { PrismaClient } from "@prisma/client";
import type { createAsanaClientFactory } from "../asana/asana.client";
import { createAsanaService } from "../asana/asana.service";
import { isAsanaWriteAccessFailure, toAsanaTaskWriteForbiddenError } from "../asana/asana-errors";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors";
import type { ServiceResult } from "../../lib/result";
import {
  buildCommentHtmlText,
  htmlToPlainText,
  parseUserMentionsFromHtml,
  type MentionSpanInput
} from "./asana-rich-text";

type AsanaClientFactory = ReturnType<typeof createAsanaClientFactory>;
type AuthorizedAsanaClient = ReturnType<AsanaClientFactory["fromAccessToken"]>;
type BoardsServiceEnv = {
  APP_AUTH_SECRET: string;
  ASANA_CLIENT_ID: string;
  ASANA_CLIENT_SECRET: string;
  ASANA_REDIRECT_URI: string;
};

type WorkspaceUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  asanaProfileImageUrl: string | null;
  asanaUserGid: string | null;
};

const STORY_OPT_FIELDS = [
  "gid",
  "created_at",
  "resource_subtype",
  "text",
  "html_text",
  "created_by",
  "created_by.gid",
  "created_by.name"
].join(",");

const FOLLOWER_SETTLE_MS = 2_000;

interface AsanaStoryRecord {
  gid?: string;
  resource_subtype?: string;
  text?: string;
  html_text?: string;
  created_at?: string;
  created_by?: {
    gid?: string;
    name?: string;
  };
}

export function createCardCommentsService(
  prisma: PrismaClient,
  asanaClientFactory: AsanaClientFactory,
  env: BoardsServiceEnv
) {
  const asanaService = createAsanaService(prisma, env);

  async function listCardComments(
    actingUserId: string,
    boardId: string,
    cardId: string
  ): Promise<ServiceResult<CardComment[]>> {
    const { card, board } = await loadCardContext(boardId, cardId);
    const workspaceUsers = await loadWorkspaceUsers();
    const stories = await withAsanaStoryClient(actingUserId, board, (client) =>
      listCommentStoriesForTask(client, card.asanaTaskGid)
    );

    const comments: CardComment[] = [];
    for (const story of stories) {
      const comment = await upsertStoryComment(card.id, card.asanaTaskGid, story, workspaceUsers);
      comments.push(comment);
    }

    comments.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    return { data: comments, source: "database" };
  }

  async function createCardComment(
    actingUserId: string,
    boardId: string,
    cardId: string,
    input: CreateCardCommentInput
  ): Promise<ServiceResult<CardComment>> {
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestError("Comment cannot be empty.");
    }

    const { card, board } = await loadCardContext(boardId, cardId);
    const workspaceUsers = await loadWorkspaceUsers();
    const mentionSpans = await resolveMentionSpans(input.mentions, body, workspaceUsers);
    const htmlText = buildCommentHtmlText(body, mentionSpans);
    const mentionedAsanaGids = [...new Set(mentionSpans.map((mention) => mention.asanaUserGid))];

    const story = await withAsanaStoryClient(actingUserId, board, async (client) => {
      if (mentionedAsanaGids.length > 0) {
        const addedFollowers = await ensureTaskFollowers(client, card.asanaTaskGid, mentionedAsanaGids);
        if (addedFollowers) {
          await sleep(FOLLOWER_SETTLE_MS);
        }
      }

      const response = await client.stories.createStoryForTask(
        { data: { html_text: htmlText } },
        card.asanaTaskGid,
        { opt_fields: STORY_OPT_FIELDS }
      );

      return response.data as AsanaStoryRecord;
    });

    const comment = await upsertStoryComment(card.id, card.asanaTaskGid, story, workspaceUsers);
    return { data: comment, source: "database" };
  }

  async function loadCardContext(boardId: string, cardId: string) {
    const board = await prisma.board.findUnique({
      where: { id: boardId }
    });

    if (!board) {
      throw new NotFoundError("Board not found");
    }

    const card = await prisma.card.findFirst({
      where: {
        id: cardId,
        boardId: board.id
      }
    });

    if (!card) {
      throw new NotFoundError("Card not found");
    }

    return { card, board };
  }

  async function loadWorkspaceUsers(): Promise<WorkspaceUserRecord[]> {
    return prisma.appUser.findMany({
        select: {
          id: true,
          email: true,
          displayName: true,
          asanaProfileImageUrl: true,
          asanaUserGid: true
        }
      });
  }

  async function resolveMentionSpans(
    mentions: CreateCardCommentInput["mentions"],
    body: string,
    workspaceUsers: WorkspaceUserRecord[]
  ): Promise<MentionSpanInput[]> {
    const usersById = new Map(workspaceUsers.map((user) => [user.id, user]));
    const spans: MentionSpanInput[] = [];

    for (const mention of mentions) {
      const user = usersById.get(mention.appUserId);
      if (!user) {
        throw new BadRequestError("One or more mentioned users are not workspace members.");
      }

      if (!user.asanaUserGid) {
        throw new BadRequestError("User must connect Asana to be @mentioned.");
      }

      const segment = body.slice(mention.start, mention.start + mention.length);
      if (!segment) {
        throw new BadRequestError("Invalid mention position in comment body.");
      }

      spans.push({
        start: mention.start,
        length: mention.length,
        asanaUserGid: user.asanaUserGid,
        label: segment
      });
    }

    return spans;
  }

  async function withAsanaStoryClient<T>(
    actingUserId: string,
    board: { importedByAppUserId: string },
    operation: (client: AuthorizedAsanaClient) => Promise<T>
  ): Promise<T> {
    const primaryClient = await requireAsanaClient(actingUserId);

    try {
      return await operation(primaryClient);
    } catch (error) {
      if (!isAsanaWriteAccessFailure(error)) {
        throw error;
      }

      const fallbackUserId = board.importedByAppUserId;
      if (fallbackUserId === actingUserId) {
        throw toAsanaTaskWriteForbiddenError();
      }

      const fallbackClient = await asanaService.createAuthorizedClientForUser(fallbackUserId, asanaClientFactory);
      if (!fallbackClient) {
        throw toAsanaTaskWriteForbiddenError();
      }

      try {
        return await operation(fallbackClient);
      } catch (fallbackError) {
        if (isAsanaWriteAccessFailure(fallbackError)) {
          throw toAsanaTaskWriteForbiddenError();
        }

        throw fallbackError;
      }
    }
  }

  async function requireAsanaClient(userId: string) {
    const client = await asanaService.createAuthorizedClientForUser(userId, asanaClientFactory);
    if (!client) {
      throw new ForbiddenError("Connect Asana in Settings to comment.");
    }

    return client;
  }

  async function listCommentStoriesForTask(client: AuthorizedAsanaClient, taskGid: string) {
    const stories: AsanaStoryRecord[] = [];
    let offset: string | undefined;

    do {
      const response: any = await client.stories.getStoriesForTask(taskGid, {
        limit: 100,
        offset,
        opt_fields: STORY_OPT_FIELDS
      });

      const pageStories = (response.data ?? []) as AsanaStoryRecord[];
      stories.push(...pageStories.filter((story) => story.resource_subtype === "comment_added"));
      offset = response.next_page?.offset ?? response.nextPage?.offset ?? undefined;
    } while (offset);

    return stories;
  }

  async function ensureTaskFollowers(
    client: AuthorizedAsanaClient,
    taskGid: string,
    followerGids: string[]
  ): Promise<boolean> {
    if (followerGids.length === 0) {
      return false;
    }

    await client.tasks.addFollowersForTask(
      {
        data: {
          followers: followerGids
        }
      },
      taskGid
    );

    return true;
  }

  async function upsertStoryComment(
    cardId: string,
    asanaTaskGid: string,
    story: AsanaStoryRecord,
    workspaceUsers: WorkspaceUserRecord[]
  ): Promise<CardComment> {
    const storyGid = String(story.gid ?? "");
    if (!storyGid) {
      throw new Error("Asana story response did not include a gid.");
    }

    const htmlText = story.html_text ?? (story.text ? `<body>${story.text}</body>` : "<body></body>");
    const plainText = story.text?.trim() || htmlToPlainText(htmlText);
    const authorAsanaGid = story.created_by?.gid ? String(story.created_by.gid) : null;
    const authorAppUser = authorAsanaGid
      ? workspaceUsers.find((user) => user.asanaUserGid === authorAsanaGid)
      : undefined;
    const authorName = story.created_by?.name?.trim()
      || (authorAppUser ? formatUserDisplayName(authorAppUser) : "Unknown");
    const createdAt = story.created_at ? new Date(story.created_at) : new Date();

    await prisma.cardComment.upsert({
      where: { asanaStoryGid: storyGid },
      update: {
        htmlText,
        plainText,
        authorName,
        authorAppUserId: authorAppUser?.id ?? null,
        authorAsanaGid
      },
      create: {
        cardId,
        asanaStoryGid: storyGid,
        asanaTaskGid,
        authorAppUserId: authorAppUser?.id ?? null,
        authorAsanaGid,
        authorName,
        htmlText,
        plainText,
        createdAt
      }
    });

    return mapStoryToComment(
      cardId,
      storyGid,
      htmlText,
      plainText,
      authorName,
      authorAppUser?.id,
      createdAt.toISOString(),
      workspaceUsers
    );
  }

  function mapStoryToComment(
    cardId: string,
    storyGid: string,
    htmlText: string,
    plainText: string,
    authorName: string,
    authorAppUserId: string | undefined,
    createdAt: string,
    workspaceUsers: WorkspaceUserRecord[]
  ): CardComment {
    const usersByAsanaGid = new Map(
      workspaceUsers
        .filter((user): user is WorkspaceUserRecord & { asanaUserGid: string } => Boolean(user.asanaUserGid))
        .map((user) => [user.asanaUserGid, user])
    );

    const parsedMentions = parseUserMentionsFromHtml(htmlText);
    const mentions: CardCommentMention[] = parsedMentions.map((mention) => {
      const workspaceUser = usersByAsanaGid.get(mention.asanaUserGid);
      return {
        appUserId: workspaceUser?.id,
        asanaUserGid: mention.asanaUserGid,
        displayName: workspaceUser ? formatUserDisplayName(workspaceUser) : mention.displayName,
        start: 0,
        length: 0
      };
    });

    let searchFrom = 0;
    for (const mention of mentions) {
      const label = mention.displayName.startsWith("@") ? mention.displayName : `@${mention.displayName}`;
      const index = plainText.indexOf(label, searchFrom);
      if (index >= 0) {
        mention.start = index;
        mention.length = label.length;
        searchFrom = index + label.length;
      }
    }

    return {
      id: storyGid,
      cardId,
      asanaStoryGid: storyGid,
      authorAppUserId,
      authorName,
      htmlText,
      plainText,
      createdAt,
      mentions
    };
  }

  return {
    listCardComments,
    createCardComment
  };
}

function formatUserDisplayName(user: { email: string; displayName: string | null }) {
  return user.displayName?.trim() || user.email;
}

function sleep(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
