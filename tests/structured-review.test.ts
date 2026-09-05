import { describe, expect, it } from "vitest";

import {
  findingToMarkdown,
  meetsMinimumSeverity,
  parseStoredReview,
  serializeReview,
} from "../lib/structured-review";
import type { StructuredReview } from "../types";

const review: StructuredReview = {
  version: 1,
  summary: "One issue needs attention.",
  findings: [{
    id: "finding-1",
    severity: "high",
    title: "Unsafe query",
    path: "api/users.ts",
    line: 18,
    problem: "User input is added directly to the query.",
    impact: "An attacker can read private data.",
    fix: "Use a parameterized query.",
    suggested_code: "db.query('SELECT * FROM users WHERE id = ?', [id]);",
    language: "typescript",
  }],
};

describe("structured reviews", () => {
  it("round trips structured output", () => {
    expect(parseStoredReview(serializeReview(review))).toEqual(review);
  });

  it("keeps old text reviews readable", () => {
    expect(parseStoredReview("Old review text")?.findings[0]?.problem).toBe("Old review text");
  });

  it("formats an actionable GitHub comment", () => {
    const markdown = findingToMarkdown(review.findings[0]);
    expect(markdown).toContain("api/users.ts:18");
    expect(markdown).toContain("Suggested code");
  });

  it("filters findings by severity", () => {
    expect(meetsMinimumSeverity("high", "medium")).toBe(true);
    expect(meetsMinimumSeverity("low", "high")).toBe(false);
  });
});
