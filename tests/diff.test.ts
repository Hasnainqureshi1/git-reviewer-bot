import { describe, expect, it } from "vitest";

import { chunkDiff } from "../lib/diff";

describe("chunkDiff", () => {
  it("splits on line boundaries when possible", () => {
    const result = chunkDiff("line one\nline two\nline three", 100, 15);
    expect(result.chunks).toEqual(["line one\n", "line two\n", "line three\n"]);
    expect(result.truncated).toBe(false);
  });

  it("caps large diffs and reports truncation", () => {
    const result = chunkDiff("a\n".repeat(100), 50, 20);
    expect(result.chunks.join("").length).toBeLessThanOrEqual(51);
    expect(result.truncated).toBe(true);
    expect(result.originalCharacters).toBe(200);
  });

  it("returns a reviewable placeholder for an empty diff", () => {
    expect(chunkDiff("").chunks).toEqual(["(empty diff)"]);
  });
});
