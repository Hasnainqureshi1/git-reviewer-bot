import { completeReview, failReview } from "@/lib/database";
import { reviewCode } from "@/lib/gemini";
import { fetchPullRequestDiff } from "@/lib/github";

interface ReviewJob {
  reviewId: string;
  owner: string;
  repo: string;
  pullNumber: number;
  accessToken: string;
}

export async function processPullRequestReview(job: ReviewJob): Promise<void> {
  try {
    const diff = await fetchPullRequestDiff(job.owner, job.repo, job.pullNumber, job.accessToken);
    const review = await reviewCode(diff);
    await completeReview(job.reviewId, review);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected review failure";
    console.error("Pull request review failed", { reviewId: job.reviewId, error });
    await failReview(job.reviewId, message);
  }
}
