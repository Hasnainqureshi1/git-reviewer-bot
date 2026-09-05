"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  LoaderCircle,
  RefreshCcw,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ReviewRecord } from "@/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

function reviewStatus(review: ReviewRecord) {
  if (review.status === "pending") {
    return { label: "Reviewing", icon: Clock3, className: "text-amber-300 bg-amber-300/10" };
  }
  if (review.status === "failed") {
    return { label: "Needs retry", icon: AlertTriangle, className: "text-rose-300 bg-rose-300/10" };
  }
  if (review.comment_url) {
    return { label: "Published", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-300/10" };
  }
  return { label: "Ready to publish", icon: Send, className: "text-sky-300 bg-sky-300/10" };
}

export function ReviewHistory({ initialReviews }: { initialReviews: ReviewRecord[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(
    initialReviews.find((review) => review.status === "completed" && !review.comment_url)?.id ?? null,
  );
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryBaselines, setRetryBaselines] = useState<Record<string, string | null>>({});
  const [publishedUrls, setPublishedUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  const reviews = initialReviews.map((review) => {
    const hasRetryBaseline = Object.prototype.hasOwnProperty.call(retryBaselines, review.id);
    const retryWasJustAccepted =
      hasRetryBaseline &&
      review.status === "failed" &&
      review.completed_at === retryBaselines[review.id];

    return {
      ...review,
      ...(retryWasJustAccepted
        ? { status: "pending" as const, error_message: null, completed_at: null }
        : {}),
      ...(publishedUrls[review.id] ? { comment_url: publishedUrls[review.id] } : {}),
    };
  });
  const hasPendingReviews = reviews.some((review) => review.status === "pending");

  useEffect(() => {
    if (!hasPendingReviews) return;
    const timer = window.setInterval(() => router.refresh(), 5_000);
    return () => window.clearInterval(timer);
  }, [hasPendingReviews, router]);

  async function publish(reviewId: string) {
    setPublishingId(reviewId);
    setError(null);

    try {
      const response = await fetch(`/api/reviews/${reviewId}/publish`, { method: "POST" });
      const body = (await response.json()) as { commentUrl?: string; error?: string };
      if (!response.ok || !body.commentUrl) throw new Error(body.error ?? "Could not publish review");

      setPublishedUrls((current) => ({ ...current, [reviewId]: body.commentUrl! }));
    } catch (reason) {
      setError({
        id: reviewId,
        message: reason instanceof Error ? reason.message : "Could not publish review",
      });
    } finally {
      setPublishingId(null);
    }
  }

  async function retry(reviewId: string) {
    const review = reviews.find((candidate) => candidate.id === reviewId);
    setRetryingId(reviewId);
    setError(null);

    try {
      const response = await fetch(`/api/reviews/${reviewId}/retry`, { method: "POST" });
      const body = (await response.json()) as { accepted?: boolean };
      if (!response.ok || !body.accepted) throw new Error("Could not start the retry");

      setRetryBaselines((current) => ({
        ...current,
        [reviewId]: review?.completed_at ?? null,
      }));
    } catch {
      setError({ id: reviewId, message: "Retry could not be started. Please try again." });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="panel overflow-hidden rounded-2xl">
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <div>
          <h2 className="font-medium text-white">Review findings</h2>
          <p className="mt-1 text-xs text-slate-500">Approve findings before they are posted to GitHub.</p>
        </div>
        {reviews.length > 0 && (
          <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[11px] text-slate-500">
            {reviews.length} {reviews.length === 1 ? "pull request" : "pull requests"}
          </span>
        )}
      </div>

      <div className="divide-y divide-white/[0.06]">
        {reviews.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-600">
              <Bot size={21} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-300">No reviews yet</p>
            <p className="mt-1 text-xs text-slate-600">Open or update a PR in a connected repository.</p>
          </div>
        ) : (
          reviews.map((review) => {
            const status = reviewStatus(review);
            const StatusIcon = status.icon;
            const isExpanded = expandedId === review.id;
            const isReady = review.status === "completed" && !review.comment_url && Boolean(review.ai_response);

            return (
              <article key={review.id} className="px-5 py-5 transition-colors hover:bg-white/[0.015] sm:px-6">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${status.className}`}>
                    <StatusIcon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <a
                        href={review.pr_url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 text-sm font-medium leading-5 text-slate-200 transition hover:text-emerald-300"
                      >
                        {review.pr_title}
                      </a>
                      <span className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-600">
                      {review.repos?.full_name} #{review.pr_number} · {formatDate(review.created_at)}
                    </p>

                    {review.status === "pending" && (
                      <p className="mt-3 flex items-center gap-2 text-xs text-amber-200/70">
                        <LoaderCircle className="animate-spin" size={13} />
                        AI is reviewing the latest changes. This page updates automatically.
                      </p>
                    )}

                    {review.status === "failed" && (
                      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-slate-400">
                          The review could not finish. Your pull request is safe—try it again.
                        </p>
                        <button
                          type="button"
                          onClick={() => void retry(review.id)}
                          disabled={retryingId !== null}
                          className="flex shrink-0 items-center justify-center gap-2 rounded-lg border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/[0.14] disabled:cursor-wait disabled:opacity-60"
                        >
                          {retryingId === review.id ? (
                            <LoaderCircle className="animate-spin" size={14} />
                          ) : (
                            <RefreshCcw size={14} />
                          )}
                          {retryingId === review.id ? "Retrying…" : "Retry review"}
                        </button>
                      </div>
                    )}

                    {review.ai_response && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : review.id)}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
                      >
                        <ChevronDown size={14} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Hide findings" : "Review findings"}
                      </button>
                    )}

                    {isExpanded && review.ai_response && (
                      <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 p-4">
                        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap pr-2 font-sans text-xs leading-6 text-slate-300">
                          {review.ai_response}
                        </pre>
                        {isReady && (
                          <button
                            type="button"
                            onClick={() => void publish(review.id)}
                            disabled={publishingId !== null}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-wait disabled:opacity-70"
                          >
                            {publishingId === review.id ? (
                              <LoaderCircle className="animate-spin" size={15} />
                            ) : (
                              <Send size={15} />
                            )}
                            {publishingId === review.id ? "Publishing…" : "Post to GitHub"}
                          </button>
                        )}
                        {review.comment_url && (
                          <a
                            href={review.comment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-300/10"
                          >
                            View published comment <ExternalLink size={14} />
                          </a>
                        )}
                        {error?.id === review.id && review.status !== "failed" && (
                          <p className="mt-3 text-xs leading-5 text-red-300" role="alert">
                            {error.message}
                          </p>
                        )}
                      </div>
                    )}

                    {error?.id === review.id && review.status === "failed" && (
                      <p className="mt-2 text-xs text-rose-300" role="alert">
                        {error.message}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
