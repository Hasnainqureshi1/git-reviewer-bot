import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getReviewForPublishing, markReviewPublished } from "@/lib/database";
import { postPullRequestComment } from "@/lib/github";
import { formatReviewComment } from "@/lib/review-comment";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const context = await getReviewForPublishing(id, session.user.id);
    if (!context) return Response.json({ error: "Review not found" }, { status: 404 });

    if (context.review.comment_url) {
      return Response.json({ commentUrl: context.review.comment_url, alreadyPublished: true });
    }
    if (context.review.status === "pending") {
      return Response.json({ error: "The AI review is still processing" }, { status: 409 });
    }
    if (context.review.status === "failed" || !context.review.ai_response) {
      return Response.json({ error: "This review has no findings available to publish" }, { status: 409 });
    }

    const commentUrl = await postPullRequestComment(
      context.repo.owner,
      context.repo.name,
      context.review.pr_number,
      context.accessToken,
      formatReviewComment(context.review.ai_response),
    );
    await markReviewPublished(context.review.id, commentUrl);

    return Response.json({ commentUrl });
  } catch (error) {
    console.error("Could not publish review", error);
    const message = error instanceof Error ? error.message : "Could not publish review";
    return Response.json({ error: message }, { status: 500 });
  }
}
