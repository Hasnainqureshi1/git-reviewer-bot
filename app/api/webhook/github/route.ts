import { after } from "next/server";

import {
  countReviewsSince,
  createPendingReview,
  finishReviewJob,
  findWebhookRepository,
  startReviewJob,
} from "@/lib/database";
import { requireEnv } from "@/lib/env";
import { processPullRequestReview } from "@/lib/process-review";
import { getRepoSettings } from "@/lib/repo-settings";
import { verifyGitHubSignature } from "@/lib/webhook-signature";
import type { PullRequestWebhookPayload } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const REVIEW_ACTIONS = new Set(["opened", "synchronize"]);

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyGitHubSignature(rawBody, signature, requireEnv("GITHUB_WEBHOOK_SECRET"))) {
    return Response.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = request.headers.get("x-github-event");
  if (event === "ping") return Response.json({ ok: true });
  if (event !== "pull_request") return Response.json({ ignored: true });

  let payload: PullRequestWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as PullRequestWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  if (!REVIEW_ACTIONS.has(payload.action)) {
    return Response.json({ ignored: true, action: payload.action });
  }

  const deliveryId = request.headers.get("x-github-delivery");
  if (!deliveryId || !payload.repository?.id || !payload.pull_request?.number) {
    return Response.json({ error: "Incomplete webhook payload" }, { status: 400 });
  }

  try {
    const connection = await findWebhookRepository(payload.repository.id);
    if (!connection) return Response.json({ ignored: true, reason: "Repository is not connected" });
    const settings = getRepoSettings(connection.repo);
    if (!settings.auto_review) {
      return Response.json({ ignored: true, reason: "Automatic reviews are disabled" });
    }

    const dailyLimit = Number(process.env.DAILY_REVIEW_LIMIT ?? 50);
    if (Number.isFinite(dailyLimit) && dailyLimit > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString();
      const usage = await countReviewsSince(connection.repo.user_id, since);
      if (usage >= dailyLimit) {
        return Response.json({ ignored: true, reason: "Daily review limit reached" }, { status: 202 });
      }
    }

    const reviewId = await createPendingReview({
      repoId: connection.repo.id,
      deliveryId,
      prNumber: payload.pull_request.number,
      prTitle: payload.pull_request.title,
      prUrl: payload.pull_request.html_url,
      headSha: payload.pull_request.head.sha,
      reviewMode: settings.review_mode,
    });

    if (!reviewId) return Response.json({ accepted: true, duplicate: true });
    const queued = await startReviewJob(reviewId);

    after(async () => {
      const result = await processPullRequestReview({
        reviewId,
        owner: connection.repo.owner,
        repo: connection.repo.name,
        pullNumber: payload.pull_request.number,
        accessToken: connection.accessToken,
        headSha: payload.pull_request.head.sha,
        settings,
        usesGitHubApp: connection.usesGitHubApp,
      });
      if (queued) await finishReviewJob(reviewId, result);
    });

    return Response.json({ accepted: true, reviewId }, { status: 202 });
  } catch (error) {
    console.error("Webhook handling failed", error);
    return Response.json({ error: "Webhook processing could not be scheduled" }, { status: 500 });
  }
}
