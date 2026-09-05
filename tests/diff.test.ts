import { describe, expect, it } from "vitest";

import { chunkDiff, filterIgnoredPaths } from "../lib/diff";

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

describe("filterIgnoredPaths", () => {
  it("removes ignored file sections from a unified diff", () => {
    const diff = [
      "diff --git a/src/app.ts b/src/app.ts",
      "+keep",
      "diff --git a/dist/app.js b/dist/app.js",
      "+ignore",
    ].join("\n");

    const filtered = filterIgnoredPaths(diff, ["dist/*"]);
    expect(filtered).toContain("src/app.ts");
    expect(filtered).not.toContain("dist/app.js");
  });

  it("supports recursive glob patterns", () => {
    const diff = [
      "diff --git a/generated/api/client.ts b/generated/api/client.ts",
      "+ignore",
      "diff --git a/src/client.ts b/src/client.ts",
      "+keep",
    ].join("\n");

    const filtered = filterIgnoredPaths(diff, ["generated/**"]);
    expect(filtered).not.toContain("generated/api/client.ts");
    expect(filtered).toContain("src/client.ts");
  });
});
