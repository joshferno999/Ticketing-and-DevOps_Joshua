import { describe, expect, it } from "vitest";
import { extractAsanaTaskIds, primaryAsanaTaskId } from "./parsing";

describe("extractAsanaTaskIds", () => {
  it("extracts bracketed ids", () => {
    expect(extractAsanaTaskIds("feat: add webhook replay [Asana:123456789]").taskGids).toEqual(["123456789"]);
  });

  it("extracts branch ids", () => {
    expect(extractAsanaTaskIds("feature/asana-987654321-onboarding").taskGids).toEqual(["987654321"]);
  });

  it("deduplicates matches", () => {
    expect(extractAsanaTaskIds("[Asana:123456789] feature/asana-123456789-sync").taskGids).toEqual(["123456789"]);
  });

  it("returns primary match", () => {
    expect(primaryAsanaTaskId("Asana:222222222 and Asana:333333333")).toBe("222222222");
  });
});
