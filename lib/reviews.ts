import type { ReviewRecord } from "@/types";

export function latestReviewAttempts(reviews: ReviewRecord[]): ReviewRecord[] {
  const seen = new Set<string>();

  return reviews.filter((review) => {
    const key = `${review.repo_id}:${review.pr_number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
