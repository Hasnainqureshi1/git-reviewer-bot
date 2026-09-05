import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  getReviewForPublishing,
  logAuditEvent,
  markReviewPublished,
} from "@/lib/database";
import {
  GitHubApiError,
  postPullRequestComment,
  postPullRequestReview,
} from "@/lib/github";
import { formatReviewComment } from "@/lib/review-comment";
import {
  findingToMarkdown,
  parseStoredReview,
  reviewToMarkdown,
} from "@/lib/structured-review";

const findingSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  problem: z.string().min(1).max(4_000),
  impact: z.string().min(1).max(4_000),
  fix: z.string().min(1).max(4_000),
  suggested_code: z.string().max(8_000).nullable(),
});

const publishSchema = z.object({
  findings: z.array(findingSchema).min(1).max(50),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const parsedBody = publishSchema.safeParse(await request.json().catch(() => null));
    if (!parsedBody.success) {
      return Response.json({ error: "Select at least one valid finding" }, { status: 400 });
    }

    const context = await getReviewForPublishing(id, session.user.id);
    if (!context) return Response.json({ error: "Review not found" }, { status: 404 });
    if (context.review.comment_url) {
      return Response.json({ commentUrl: context.review.comment_url, alreadyPublished: true });
    }
    if (context.review.status === "pending") {
      return Response.json({ error: "The AI review is still processing" }, { status: 409 });
    }

    const storedReview = parseStoredReview(context.review.ai_response);
    if (context.review.status === "failed" || !storedReview) {
      return Response.json({ error: "This review has no findings available to publish" }, { status: 409 });
    }

    const submittedById = new Map(parsedBody.data.findings.map((finding) => [finding.id, finding]));
    const approvedFindings = storedReview.findings
      .filter((finding) => submittedById.has(finding.id))
      .map((finding) => ({ ...finding, ...submittedById.get(finding.id) }));
    if (approvedFindings.length === 0) {
      return Response.json({ error: "Select at least one finding" }, { status: 400 });
    }

    const inline = approvedFindings
      .filter((finding) => finding.path && finding.line)
      .map((finding) => ({
        path: finding.path!,
        line: finding.line!,
        body: findingToMarkdown(finding),
      }));
    const summaryOnlyFindings = approvedFindings.filter((finding) => !finding.path || !finding.line);
    const summary = formatReviewComment(reviewToMarkdown(storedReview, approvedFindings));
    const inlineSummary = [
      `AI review completed with ${approvedFindings.length} approved finding${approvedFindings.length === 1 ? "" : "s"}.`,
      summaryOnlyFindings.length > 0 ? reviewToMarkdown(storedReview, summaryOnlyFindings) : "",
    ].filter(Boolean).join("\n\n");
    let commentUrl: string;

    try {
      commentUrl = inline.length > 0
        ? await postPullRequestReview(
            context.repo.owner,
            context.repo.name,
            context.review.pr_number,
            context.accessToken,
            inlineSummary,
            inline,
          )
        : await postPullRequestComment(
            context.repo.owner,
            context.repo.name,
            context.review.pr_number,
            context.accessToken,
            summary,
          );
    } catch (error) {
      if (!(error instanceof GitHubApiError && error.status === 422 && inline.length > 0)) throw error;
      commentUrl = await postPullRequestComment(
        context.repo.owner,
        context.repo.name,
        context.review.pr_number,
        context.accessToken,
        summary,
      );
    }

    await Promise.all([
      markReviewPublished(context.review.id, commentUrl),
      logAuditEvent({
        userId: session.user.id,
        action: "review.published",
        targetType: "review",
        targetId: context.review.id,
        metadata: { findingCount: approvedFindings.length },
      }),
    ]);

    return Response.json({ commentUrl });
  } catch (error) {
    console.error("Could not publish review", error);
    return Response.json({ error: "Could not post the review. Please try again." }, { status: 500 });
  }
}
