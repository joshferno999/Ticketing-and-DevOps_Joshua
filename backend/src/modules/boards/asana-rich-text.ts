export interface MentionSpanInput {
  start: number;
  length: number;
  asanaUserGid: string;
  label: string;
}

export interface ParsedUserMention {
  asanaUserGid: string;
  displayName: string;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&apos;"
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPE_MAP[character] ?? character);
}

export function buildCommentHtmlText(body: string, mentions: MentionSpanInput[]): string {
  const sortedMentions = [...mentions].sort((left, right) => right.start - left.start);
  let htmlBody = escapeHtml(body);

  for (const mention of sortedMentions) {
    const before = htmlBody.slice(0, mention.start);
    const mentionText = htmlBody.slice(mention.start, mention.start + mention.length);
    const after = htmlBody.slice(mention.start + mention.length);
    const anchor = `<a data-asana-gid="${escapeHtml(mention.asanaUserGid)}" data-asana-type="user">${mentionText}</a>`;
    htmlBody = `${before}${anchor}${after}`;
  }

  return `<body>${htmlBody}</body>`;
}

export function parseUserMentionsFromHtml(htmlText: string): ParsedUserMention[] {
  const mentions: ParsedUserMention[] = [];
  const anchorPattern = /<a\b[^>]*data-asana-type=["']user["'][^>]*>/gi;
  let match: RegExpExecArray | null = anchorPattern.exec(htmlText);

  while (match) {
    const tag = match[0];
    const gidMatch = tag.match(/data-asana-gid=["']([^"']+)["']/i);
    const asanaUserGid = gidMatch?.[1];
    if (!asanaUserGid) {
      match = anchorPattern.exec(htmlText);
      continue;
    }

    const startIndex = match.index;
    const closeIndex = htmlText.indexOf("</a>", startIndex);
    const innerHtml = closeIndex === -1
      ? ""
      : htmlText.slice(startIndex + tag.length, closeIndex);
    const displayName = stripHtmlTags(innerHtml).trim() || "User";

    mentions.push({
      asanaUserGid,
      displayName
    });
    match = anchorPattern.exec(htmlText);
  }

  return mentions;
}

export function htmlToPlainText(htmlText: string): string {
  const withoutBody = htmlText.replace(/^<body>/i, "").replace(/<\/body>$/i, "");
  return stripHtmlTags(withoutBody)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlTags(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "");
}
