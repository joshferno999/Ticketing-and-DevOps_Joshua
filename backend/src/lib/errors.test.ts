import { describe, expect, it } from "vitest";
import { ForbiddenError, getErrorStatusCode, NotFoundError } from "./errors";

describe("domain errors", () => {
  it("maps forbidden errors to 403", () => {
    expect(getErrorStatusCode(new ForbiddenError("Connect Asana in Settings to make changes."))).toBe(403);
  });

  it("maps not found errors to 404", () => {
    expect(getErrorStatusCode(new NotFoundError("Board not found"))).toBe(404);
  });
});
