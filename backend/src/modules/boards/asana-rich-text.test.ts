import { describe, expect, it } from "vitest";
import {
  buildCommentHtmlText,
  escapeHtml,
  htmlToPlainText,
  parseUserMentionsFromHtml
} from "./asana-rich-text";

describe("asana-rich-text", () => {
  it("escapes XML-sensitive characters", () => {
    expect(escapeHtml(`Tom & Jerry <3`)).toBe("Tom &amp; Jerry &lt;3");
  });

  it("builds html_text with user mention anchors right-to-left", () => {
    const body = "Hey @Alice and @Bob";
    const html = buildCommentHtmlText(body, [
      { start: 4, length: 6, asanaUserGid: "111", label: "@Alice" },
      { start: 15, length: 4, asanaUserGid: "222", label: "@Bob" }
    ]);

    expect(html).toContain('<a data-asana-gid="111" data-asana-type="user">@Alice</a>');
    expect(html).toContain('<a data-asana-gid="222" data-asana-type="user">@Bob</a>');
    expect(html.startsWith("<body>")).toBe(true);
    expect(html.endsWith("</body>")).toBe(true);
  });

  it("parses user mentions from Asana html_text", () => {
    const html = '<body>Hi <a data-asana-gid="4168112" data-asana-type="user">@Tim Bizzaro</a></body>';
    expect(parseUserMentionsFromHtml(html)).toEqual([
      { asanaUserGid: "4168112", displayName: "@Tim Bizzaro" }
    ]);
  });

  it("converts html_text to plain text", () => {
    const html = "<body>Hello <strong>world</strong></body>";
    expect(htmlToPlainText(html)).toBe("Hello world");
  });
});
