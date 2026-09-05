import {
  claimReviewJobs,
  failReview,
  finishReviewJob,
  getReviewJobContext,
  resetReviewForProcessing,
} from "@/lib/database";
import { processPullRequestReview } from "@/lib/process-review";
import { getRepoSettings } from "@/lib/repo-settings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await claimReviewJobs(3);
  const results: Array<{ reviewId: string; status: string }> = [];

  for (const job of jobs) {
    try {
      const context = await getReviewJobContext(job.review_id);
      if (!context) {
        await finishReviewJob(job.review_id, "completed");
        continue;
      }
      if (context.review.status === "completed") {
        await finishReviewJob(job.review_id, "completed");
        continue;
      }

      if (context.review.status === "failed") {
        await resetReviewForProcessing(context.review.id);
      }
      const result = await processPullRequestReview({
        reviewId: context.review.id,
        owner: context.repo.owner,
        repo: context.repo.name,
        pullNumber: context.review.pr_number,
        accessToken: context.accessToken,
        headSha: context.review.head_sha,
        settings: getRepoSettings(context.repo),
        usesGitHubApp: Boolean(context.repo.github_installation_id),
      });
      await finishReviewJob(context.review.id, result);
      results.push({ reviewId: context.review.id, status: result });
    } catch (error) {
      console.error("Queued review failed", { reviewId: job.review_id, error });
      await failReview(job.review_id, "The queued review could not start");
      await finishReviewJob(job.review_id, "failed", "Queued review failed");
      results.push({ reviewId: job.review_id, status: "failed" });
    }
  }

  return Response.json({ processed: results.length, results });
}
