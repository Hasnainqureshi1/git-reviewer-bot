"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  LoaderCircle,
  Send,
} from "lucide-react";
import { useState } from "react";

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
    return { label: "Failed", icon: AlertTriangle, className: "text-red-300 bg-red-300/10" };
  }
  if (review.comment_url) {
    return { label: "Published", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-300/10" };
  }
  return { label: "Ready to publish", icon: Send, className: "text-sky-300 bg-sky-300/10" };
}

export function ReviewHistory({ initialReviews }: { initialReviews: ReviewRecord[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [expandedId, setExpandedId] = useState<string | null>(
    initialReviews.find((review) => review.status === "completed" && !review.comment_url)?.id ?? null,
  );
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(null);

  async function publish(reviewId: string) {
    setPublishingId(reviewId);
    setError(null);

    try {
      const response = await fetch(`/api/reviews/${reviewId}/publish`, { method: "POST" });
      const body = (await response.json()) as { commentUrl?: string; error?: string };
      if (!response.ok || !body.commentUrl) throw new Error(body.error ?? "Could not publish review");

      setReviews((current) =>
        current.map((review) =>
          review.id === reviewId ? { ...review, comment_url: body.commentUrl! } : review,
        ),
      );
    } catch (reason) {
      setError({
        id: reviewId,
        message: reason instanceof Error ? reason.message : "Could not publish review",
      });
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <section className="panel overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <h2 className="font-medium text-white">Review findings</h2>
        <p className="mt-1 text-xs text-slate-500">Inspect AI findings before publishing them to GitHub.</p>
      </div>
      <div className="max-h-[700px] divide-y divide-white/[0.06] overflow-y-auto">
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
              <article key={review.id} className="px-5 py-4 sm:px-6">
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
                        <pre className="whitespace-pre-wrap font-sans text-xs leading-6 text-slate-300">
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
                        {error?.id === review.id && (
                          <p className="mt-3 text-xs leading-5 text-red-300" role="alert">{error.message}</p>
                        )}
                      </div>
                    )}

                    {review.status === "failed" && review.error_message && (
                      <p className="mt-2 text-xs leading-5 text-red-300/70">{review.error_message}</p>
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
