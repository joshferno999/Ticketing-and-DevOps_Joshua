import type { CardCommentMention } from "@emergence-devops/shared";
import type { ReactNode } from "react";

const ALLOWED_TAGS = new Set([
  "body",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "ol",
  "ul",
  "li",
  "a",
  "blockquote",
  "pre",
  "br"
]);

interface AsanaRichTextProps {
  htmlText: string;
  mentions?: CardCommentMention[];
  gidToDisplayName?: Map<string, string>;
}

export function AsanaRichText({ htmlText, mentions = [], gidToDisplayName }: AsanaRichTextProps) {
  const nodes = renderHtmlNodes(htmlText, mentions, gidToDisplayName);
  return <div className="whitespace-pre-wrap break-words text-body-md leading-6 text-on-surface-variant">{nodes}</div>;
}

function renderHtmlNodes(
  htmlText: string,
  mentions: CardCommentMention[],
  gidToDisplayName?: Map<string, string>
): ReactNode {
  if (typeof window === "undefined" || !htmlText.trim()) {
    return htmlText;
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(wrapHtml(htmlText), "text/html");
  const body = document.body;

  return Array.from(body.childNodes).map((node, index) =>
    renderNode(node, `root-${index}`, mentions, gidToDisplayName)
  );
}

function wrapHtml(htmlText: string) {
  const trimmed = htmlText.trim();
  if (trimmed.startsWith("<body")) {
    return trimmed;
  }

  return `<body>${trimmed}</body>`;
}

function renderNode(
  node: ChildNode,
  key: string,
  mentions: CardCommentMention[],
  gidToDisplayName?: Map<string, string>
): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tag = element.tagName.toLowerCase();

  if (tag === "a" && element.getAttribute("data-asana-type") === "user") {
    const gid = element.getAttribute("data-asana-gid") ?? "";
    const mention = mentions.find((entry) => entry.asanaUserGid === gid);
    const label = gidToDisplayName?.get(gid)
      ?? mention?.displayName
      ?? element.textContent?.trim()
      ?? "user";
    const display = label.startsWith("@") ? label : `@${label}`;

    return (
      <span key={key} className="rounded bg-primary-fixed px-1 font-medium text-on-primary-fixed-variant">
        {display}
      </span>
    );
  }

  if (!ALLOWED_TAGS.has(tag)) {
    return Array.from(element.childNodes).map((child, index) =>
      renderNode(child, `${key}-${index}`, mentions, gidToDisplayName)
    );
  }

  const children = Array.from(element.childNodes).map((child, index) =>
    renderNode(child, `${key}-${index}`, mentions, gidToDisplayName)
  );

  switch (tag) {
    case "strong":
      return <strong key={key}>{children}</strong>;
    case "em":
      return <em key={key}>{children}</em>;
    case "u":
      return <u key={key}>{children}</u>;
    case "s":
      return <s key={key}>{children}</s>;
    case "code":
      return <code key={key} className="rounded bg-surface-container-high px-1">{children}</code>;
    case "blockquote":
      return <blockquote key={key} className="border-l-2 border-outline-variant pl-3">{children}</blockquote>;
    case "pre":
      return <pre key={key} className="overflow-x-auto rounded bg-surface-container-high p-2">{children}</pre>;
    case "ol":
      return <ol key={key} className="list-decimal pl-5">{children}</ol>;
    case "ul":
      return <ul key={key} className="list-disc pl-5">{children}</ul>;
    case "li":
      return <li key={key}>{children}</li>;
    case "br":
      return <br key={key} />;
    case "a":
      return (
        <a key={key} className="text-story-blue underline" href={element.getAttribute("href") ?? undefined} rel="noreferrer" target="_blank">
          {children}
        </a>
      );
    default:
      return <span key={key}>{children}</span>;
  }
}
