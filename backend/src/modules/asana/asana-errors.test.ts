import { describe, expect, it } from "vitest";
import { isAsanaWriteAccessFailure } from "./asana-errors";

describe("isAsanaWriteAccessFailure", () => {
  it("detects write_access_failure in response text", () => {
    const error = Object.assign(new Error("Forbidden"), {
      status: 403,
      response: {
        text: JSON.stringify({
          errors: [{ error: "write_access_failure", message: "You do not have permission to perform that action." }]
        })
      }
    });

    expect(isAsanaWriteAccessFailure(error)).toBe(true);
  });

  it("ignores other 403 errors", () => {
    const error = Object.assign(new Error("Forbidden"), {
      status: 403,
      response: {
        text: JSON.stringify({
          errors: [{ error: "premium_only", message: "Premium required" }]
        })
      }
    });

    expect(isAsanaWriteAccessFailure(error)).toBe(false);
  });
});
