import { after } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getReviewForPublishing, resetFailedReview } from "@/lib/database";
import { processPullRequestReview } from "@/lib/process-review";

export const runtime = "nodejs";
export const maxDuration = 60;

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

    if (context.review.status === "pending") {
      return Response.json({ error: "Review is already in progress" }, { status: 409 });
    }
    if (context.review.status !== "failed") {
      return Response.json({ error: "Only failed reviews can be retried" }, { status: 409 });
    }

    const reset = await resetFailedReview(context.review.id);
    if (!reset) return Response.json({ error: "Review is already in progress" }, { status: 409 });

    after(() =>
      processPullRequestReview({
        reviewId: context.review.id,
        owner: context.repo.owner,
        repo: context.repo.name,
        pullNumber: context.review.pr_number,
        accessToken: context.accessToken,
      }),
    );

    return Response.json({ accepted: true }, { status: 202 });
  } catch (error) {
    console.error("Could not retry review", error);
    return Response.json({ error: "Could not start the retry. Please try again." }, { status: 500 });
  }
}
