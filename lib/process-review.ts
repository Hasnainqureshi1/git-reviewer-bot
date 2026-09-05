import { completeReview, failReview } from "@/lib/database";
import { reviewCode } from "@/lib/gemini";
import {
  completeReviewCheckRun,
  createReviewCheckRun,
  failReviewCheckRun,
  fetchPullRequestDiff,
  setCommitStatus,
} from "@/lib/github";
import { serializeReview } from "@/lib/structured-review";
import type { RepoSettings } from "@/types";

interface ReviewJob {
  reviewId: string;
  owner: string;
  repo: string;
  pullNumber: number;
  accessToken: string;
  settings?: Partial<RepoSettings>;
  headSha?: string | null;
  usesGitHubApp?: boolean;
}

async function updateStatus(
  job: ReviewJob,
  state: "pending" | "success" | "failure" | "error",
  description: string,
) {
  if (!job.headSha) return;
  try {
    await setCommitStatus(job.owner, job.repo, job.headSha, job.accessToken, { state, description });
  } catch (error) {
    console.error("Could not update GitHub review status", { reviewId: job.reviewId, error });
  }
}

export async function processPullRequestReview(job: ReviewJob): Promise<"completed" | "failed"> {
  let checkRunId: number | null = null;
  try {
    if (job.usesGitHubApp && job.headSha) {
      checkRunId = await createReviewCheckRun(
        job.owner,
        job.repo,
        job.headSha,
        job.accessToken,
      ).catch((error) => {
        console.error("Could not create GitHub check run", error);
        return null;
      });
    }
    if (!checkRunId) await updateStatus(job, "pending", "AI is reviewing these changes");
    const diff = await fetchPullRequestDiff(job.owner, job.repo, job.pullNumber, job.accessToken);
    const review = await reviewCode(diff, {
      mode: job.settings?.review_mode,
      minimumSeverity: job.settings?.minimum_severity,
      ignoredPaths: job.settings?.ignored_paths,
      customInstructions: job.settings?.custom_instructions,
    });
    const serializedReview = serializeReview(review);
    await completeReview(job.reviewId, serializedReview, {
      inputCharacters: diff.length,
      outputCharacters: serializedReview.length,
    });
    if (checkRunId) {
      await completeReviewCheckRun(
        job.owner,
        job.repo,
        checkRunId,
        job.accessToken,
        review,
        Boolean(job.settings?.block_on_critical),
      ).catch((error) => {
        console.error("Could not complete GitHub check run", { reviewId: job.reviewId, error });
      });
    } else {
      const hasCritical = review.findings.some((finding) => finding.severity === "critical");
      await updateStatus(
        job,
        hasCritical && job.settings?.block_on_critical ? "failure" : "success",
        review.findings.length === 0
          ? "AI review found no problems"
          : `AI review found ${review.findings.length} issue${review.findings.length === 1 ? "" : "s"}`,
      );
    }
    return "completed";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected review failure";
    console.error("Pull request review failed", { reviewId: job.reviewId, error });
    await failReview(job.reviewId, message);
    if (checkRunId) {
      await failReviewCheckRun(job.owner, job.repo, checkRunId, job.accessToken).catch(console.error);
    } else {
      await updateStatus(job, "error", "AI review could not finish - retry from the dashboard");
    }
    return "failed";
  }
}
