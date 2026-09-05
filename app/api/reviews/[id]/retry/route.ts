import { after } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  getReviewForPublishing,
  finishReviewJob,
  logAuditEvent,
  resetReviewForProcessing,
  startReviewJob,
} from "@/lib/database";
import { processPullRequestReview } from "@/lib/process-review";
import { getRepoSettings } from "@/lib/repo-settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const retrySchema = z.object({
  mode: z.enum(["balanced", "security", "performance"]).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsed = retrySchema.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) return Response.json({ error: "Choose a valid review mode" }, { status: 400 });
    const context = await getReviewForPublishing(id, session.user.id);
    if (!context) return Response.json({ error: "Review not found" }, { status: 404 });

    if (context.review.status === "pending") {
      return Response.json({ error: "Review is already in progress" }, { status: 409 });
    }
    if (context.review.comment_url) {
      return Response.json({ error: "Published reviews cannot be regenerated" }, { status: 409 });
    }

    const reset = await resetReviewForProcessing(context.review.id);
    if (!reset) return Response.json({ error: "Review is already in progress" }, { status: 409 });

    const settings = getRepoSettings(context.repo);
    settings.review_mode = parsed.data.mode ?? settings.review_mode;

    await logAuditEvent({
      userId: session.user.id,
      action: context.review.status === "failed" ? "review.retried" : "review.regenerated",
      targetType: "review",
      targetId: context.review.id,
      metadata: { mode: settings.review_mode },
    });

    const queued = await startReviewJob(context.review.id);
    after(async () => {
      const result = await processPullRequestReview({
        reviewId: context.review.id,
        owner: context.repo.owner,
        repo: context.repo.name,
        pullNumber: context.review.pr_number,
        accessToken: context.accessToken,
        settings,
        headSha: context.review.head_sha,
        usesGitHubApp: Boolean(context.repo.github_installation_id),
      });
      if (queued) await finishReviewJob(context.review.id, result);
    });

    return Response.json({ accepted: true }, { status: 202 });
  } catch (error) {
    console.error("Could not retry review", error);
    return Response.json({ error: "Could not start the retry. Please try again." }, { status: 500 });
  }
}
