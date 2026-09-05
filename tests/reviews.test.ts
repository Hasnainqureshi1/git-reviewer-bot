import { describe, expect, it } from "vitest";

import { latestReviewAttempts } from "../lib/reviews";
import type { ReviewRecord } from "../types";

function review(id: string, repoId: string, pullNumber: number): ReviewRecord {
  return {
    id,
    repo_id: repoId,
    github_delivery_id: `delivery-${id}`,
    pr_number: pullNumber,
    pr_title: `Pull request ${pullNumber}`,
    pr_url: `https://github.com/example/repo/pull/${pullNumber}`,
    status: "completed",
    ai_response: "Finding",
    comment_url: null,
    error_message: null,
    created_at: "2026-09-05T00:00:00.000Z",
    completed_at: "2026-09-05T00:01:00.000Z",
  };
}

describe("latestReviewAttempts", () => {
  it("keeps only the newest attempt for each repository pull request", () => {
    const reviews = [
      review("new", "repo-a", 2),
      review("old", "repo-a", 2),
      review("another-pr", "repo-a", 1),
      review("another-repo", "repo-b", 2),
    ];

    expect(latestReviewAttempts(reviews).map((item) => item.id)).toEqual([
      "new",
      "another-pr",
      "another-repo",
    ]);
  });
});
