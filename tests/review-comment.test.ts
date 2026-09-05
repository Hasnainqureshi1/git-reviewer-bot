import { describe, expect, it } from "vitest";

import { formatReviewComment } from "../lib/review-comment";

describe("formatReviewComment", () => {
  it("wraps approved findings in an identifiable GitHub comment", () => {
    const comment = formatReviewComment("- **High** SQL injection risk");

    expect(comment).toContain("AI Review Bot");
    expect(comment).toContain("SQL injection risk");
    expect(comment).toContain("approved by a repository maintainer");
  });
});
