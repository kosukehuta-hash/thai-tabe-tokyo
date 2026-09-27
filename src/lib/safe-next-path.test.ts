import { describe, expect, it } from "vitest";
import { sanitizeNextPath } from "./safe-next-path";

describe("sanitizeNextPath", () => {
  it("rejects a path that normalizes to a protocol-relative host via dot-segments", () => {
    expect(sanitizeNextPath("/..//example.com")).toBe("/");
  });

  it("rejects a path that normalizes to a protocol-relative host via percent-encoded dot-segments", () => {
    expect(sanitizeNextPath("/%2e%2e//example.com")).toBe("/");
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeNextPath("//example.com")).toBe("/");
  });

  it("rejects a backslash-prefixed host", () => {
    expect(sanitizeNextPath("/\\example.com")).toBe("/");
  });

  it("rejects an absolute URL to an external origin", () => {
    expect(sanitizeNextPath("https://example.com")).toBe("/");
  });

  it("returns a safe same-origin path with query as-is", () => {
    expect(sanitizeNextPath("/store/1?area_id=1")).toBe("/store/1?area_id=1");
  });
});
