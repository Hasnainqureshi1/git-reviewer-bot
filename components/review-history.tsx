"use client";

import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Code2,
  ExternalLink,
  LoaderCircle,
  Pencil,
  RefreshCcw,
  Search,
  Send,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { parseStoredReview } from "@/lib/structured-review";
import type {
  ReviewFinding,
  ReviewMode,
  ReviewRecord,
  ReviewSeverity,
} from "@/types";

type ReviewFilter = "all" | "action" | "reviewing" | "published" | "failed";
type FindingDraft = ReviewFinding & { selected: boolean };

const severityStyles: Record<ReviewSeverity, string> = {
  critical: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  high: "border-orange-400/20 bg-orange-400/10 text-orange-200",
  medium: "border-amber-300/20 bg-amber-300/10 text-amber-200",
  low: "border-sky-300/20 bg-sky-300/10 text-sky-200",
};

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

function reviewStatus(review: ReviewRecord, findingCount: number) {
  if (review.status === "pending") {
    return { label: "Reviewing", icon: Clock3, className: "text-amber-300 bg-amber-300/10" };
  }
  if (review.status === "failed") {
    return { label: "Needs retry", icon: AlertTriangle, className: "text-rose-300 bg-rose-300/10" };
  }
  if (review.comment_url) {
    return { label: "Published", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-300/10" };
  }
  if (findingCount === 0) {
    return { label: "No issues", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-300/10" };
  }
  return { label: "Needs action", icon: Send, className: "text-sky-300 bg-sky-300/10" };
}

function initialDrafts(review: ReviewRecord): FindingDraft[] {
  return (parseStoredReview(review.ai_response)?.findings ?? []).map((finding) => ({
    ...finding,
    selected: true,
  }));
}

export function ReviewHistory({ initialReviews }: { initialReviews: ReviewRecord[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(
    initialReviews.find((review) => review.status === "completed" && !review.comment_url)?.id ?? null,
  );
  const [draftsByReview, setDraftsByReview] = useState<Record<string, FindingDraft[]>>({});
  const [editingFinding, setEditingFinding] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryBaselines, setRetryBaselines] = useState<Record<string, string | null>>({});
  const [publishedUrls, setPublishedUrls] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, ReviewMode>>({});
  const [error, setError] = useState<{ id: string; message: string } | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [page, setPage] = useState(1);

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

  const normalizedQuery = query.trim().toLowerCase();
  const filteredReviews = reviews.filter((review) => {
    const matchesQuery =
      !normalizedQuery ||
      review.pr_title.toLowerCase().includes(normalizedQuery) ||
      review.repos?.full_name?.toLowerCase().includes(normalizedQuery) ||
      String(review.pr_number) === normalizedQuery;
    if (!matchesQuery) return false;
    if (filter === "action") {
      return review.status === "completed" &&
        !review.comment_url &&
        Boolean(parseStoredReview(review.ai_response)?.findings.length);
    }
    if (filter === "reviewing") return review.status === "pending";
    if (filter === "published") return Boolean(review.comment_url);
    if (filter === "failed") return review.status === "failed";
    return true;
  });
  const pageSize = 5;
  const pageCount = Math.max(1, Math.ceil(filteredReviews.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const visibleReviews = filteredReviews.slice((safePage - 1) * pageSize, safePage * pageSize);
  const severityCounts = reviews.reduce<Record<ReviewSeverity, number>>(
    (counts, review) => {
      for (const finding of parseStoredReview(review.ai_response)?.findings ?? []) {
        counts[finding.severity] += 1;
      }
      return counts;
    },
    { critical: 0, high: 0, medium: 0, low: 0 },
  );

  function getDrafts(review: ReviewRecord) {
    return draftsByReview[review.id] ?? initialDrafts(review);
  }

  function expand(review: ReviewRecord) {
    if (expandedId === review.id) {
      setExpandedId(null);
      return;
    }
    setDraftsByReview((current) => (
      current[review.id] ? current : { ...current, [review.id]: initialDrafts(review) }
    ));
    setExpandedId(review.id);
  }

  function updateFinding(
    review: ReviewRecord,
    findingId: string,
    changes: Partial<FindingDraft>,
  ) {
    setDraftsByReview((current) => {
      const drafts = current[review.id] ?? initialDrafts(review);
      return {
        ...current,
        [review.id]: drafts.map((finding) =>
          finding.id === findingId ? { ...finding, ...changes } : finding,
        ),
      };
    });
  }

  async function publish(review: ReviewRecord) {
    const findings = getDrafts(review).filter((finding) => finding.selected);
    if (findings.length === 0) {
      setError({ id: review.id, message: "Select at least one finding to post." });
      return;
    }

    setPublishingId(review.id);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${review.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings }),
      });
      const body = (await response.json()) as { commentUrl?: string; error?: string };
      if (!response.ok || !body.commentUrl) throw new Error(body.error ?? "Could not publish review");
      setPublishedUrls((current) => ({ ...current, [review.id]: body.commentUrl! }));
    } catch (reason) {
      setError({
        id: review.id,
        message: reason instanceof Error ? reason.message : "Could not post the review.",
      });
    } finally {
      setPublishingId(null);
    }
  }

  async function regenerate(review: ReviewRecord) {
    setRetryingId(review.id);
    setError(null);
    try {
      const response = await fetch(`/api/reviews/${review.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: modes[review.id] ?? review.review_mode ?? "balanced" }),
      });
      const body = (await response.json()) as { accepted?: boolean };
      if (!response.ok || !body.accepted) throw new Error("Could not start the review");
      setRetryBaselines((current) => ({
        ...current,
        [review.id]: review.completed_at ?? null,
      }));
      setExpandedId(null);
    } catch {
      setError({ id: review.id, message: "The review could not start. Please try again." });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <section className="panel overflow-hidden rounded-2xl">
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="font-medium text-white">Review findings</h2>
            <p className="mt-1 text-xs text-slate-500">Choose, edit, or dismiss findings before posting.</p>
          </div>
          <label className="relative block lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search PRs"
              className="w-full rounded-lg border border-white/[0.08] bg-black/20 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-emerald-300/30"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "action", "reviewing", "published", "failed"] as ReviewFilter[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setFilter(item);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-1.5 text-[11px] font-medium capitalize transition ${
                filter === item ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
              }`}
            >
              {item === "action" ? "Needs action" : item}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(severityCounts) as ReviewSeverity[]).map((severity) => (
            <span key={severity} className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase ${severityStyles[severity]}`}>
              {severityCounts[severity]} {severity}
            </span>
          ))}
        </div>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {visibleReviews.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-600">
              <Bot size={21} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-300">No matching reviews</p>
            <p className="mt-1 text-xs text-slate-600">Try another filter or open a pull request.</p>
          </div>
        ) : (
          visibleReviews.map((review) => {
            const structured = parseStoredReview(review.ai_response);
            const drafts = getDrafts(review);
            const selectedCount = drafts.filter((finding) => finding.selected).length;
            const findingCount = structured?.findings.length ?? 0;
            const status = reviewStatus(review, findingCount);
            const StatusIcon = status.icon;
            const isExpanded = expandedId === review.id;
            const canRegenerate = review.status !== "pending" && !review.comment_url;

            return (
              <article key={review.id} className="px-5 py-5 transition-colors hover:bg-white/[0.015] sm:px-6">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${status.className}`}>
                    <StatusIcon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <a
                          href={review.pr_url}
                          target="_blank"
                          rel="noreferrer"
                          className="line-clamp-2 text-sm font-medium leading-5 text-slate-200 transition hover:text-emerald-300"
                        >
                          {review.pr_title}
                        </a>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {review.repos?.full_name} #{review.pr_number} - {formatDate(review.created_at)}
                        </p>
                      </div>
                      <span className={`w-fit shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold ${status.className}`}>
                        {status.label}
                      </span>
                    </div>

                    {review.status === "pending" && (
                      <p className="mt-3 flex items-center gap-2 text-xs text-amber-200/70">
                        <LoaderCircle className="animate-spin" size={13} />
                        AI is checking the latest changes. This page updates automatically.
                      </p>
                    )}

                    {review.status === "failed" && (
                      <div className="mt-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.04] p-3">
                        <p className="text-xs leading-5 text-slate-400">
                          The review could not finish. Your pull request is safe.
                        </p>
                      </div>
                    )}

                    {structured && review.status === "completed" && (
                      <button
                        type="button"
                        onClick={() => expand(review)}
                        className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
                      >
                        <ChevronDown size={14} className={`transition ${isExpanded ? "rotate-180" : ""}`} />
                        {isExpanded ? "Hide details" : `View ${findingCount} finding${findingCount === 1 ? "" : "s"}`}
                      </button>
                    )}

                    {isExpanded && structured && (
                      <div className="mt-4 space-y-3">
                        <p className="rounded-xl border border-white/[0.06] bg-black/20 p-3 text-xs leading-5 text-slate-400">
                          {structured.summary}
                        </p>

                        {drafts.map((finding) => {
                          const editKey = `${review.id}:${finding.id}`;
                          const isEditing = editingFinding === editKey;
                          return (
                            <div
                              key={finding.id}
                              className={`rounded-xl border p-4 transition ${
                                finding.selected
                                  ? "border-white/[0.08] bg-black/20"
                                  : "border-white/[0.04] bg-black/10 opacity-55"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={finding.selected}
                                  onChange={(event) => updateFinding(review, finding.id, { selected: event.target.checked })}
                                  className="mt-1 size-4 accent-emerald-300"
                                  aria-label={`Select ${finding.title}`}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase ${severityStyles[finding.severity]}`}>
                                      {finding.severity}
                                    </span>
                                    {finding.path && (
                                      <span className="truncate font-mono text-[11px] text-slate-500">
                                        {finding.path}{finding.line ? `:${finding.line}` : ""}
                                      </span>
                                    )}
                                  </div>

                                  {isEditing ? (
                                    <div className="mt-3 space-y-3">
                                      <label className="block text-[11px] text-slate-500">
                                        Title
                                        <input
                                          value={finding.title}
                                          onChange={(event) => updateFinding(review, finding.id, { title: event.target.value })}
                                          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-white outline-none focus:border-emerald-300/30"
                                        />
                                      </label>
                                      {([
                                        ["Problem", "problem"],
                                        ["Why it matters", "impact"],
                                        ["How to fix", "fix"],
                                      ] as const).map(([label, field]) => (
                                        <label key={field} className="block text-[11px] text-slate-500">
                                          {label}
                                          <textarea
                                            value={finding[field]}
                                            onChange={(event) => updateFinding(review, finding.id, { [field]: event.target.value })}
                                            rows={3}
                                            className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs leading-5 text-white outline-none focus:border-emerald-300/30"
                                          />
                                        </label>
                                      ))}
                                      <label className="block text-[11px] text-slate-500">
                                        Suggested code
                                        <textarea
                                          value={finding.suggested_code ?? ""}
                                          onChange={(event) => updateFinding(review, finding.id, { suggested_code: event.target.value || null })}
                                          rows={5}
                                          className="mt-1 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-xs leading-5 text-slate-200 outline-none focus:border-emerald-300/30"
                                        />
                                      </label>
                                    </div>
                                  ) : (
                                    <div className="mt-3 space-y-3 text-xs leading-5">
                                      <h3 className="text-sm font-semibold text-slate-200">{finding.title}</h3>
                                      <p className="text-slate-400"><strong className="text-slate-300">Problem:</strong> {finding.problem}</p>
                                      <p className="text-slate-400"><strong className="text-slate-300">Why it matters:</strong> {finding.impact}</p>
                                      <p className="text-slate-400"><strong className="text-slate-300">How to fix:</strong> {finding.fix}</p>
                                      {finding.suggested_code && (
                                        <div className="overflow-hidden rounded-lg border border-white/[0.07] bg-slate-950/80">
                                          <div className="flex items-center gap-2 border-b border-white/[0.06] px-3 py-2 text-[10px] text-slate-600">
                                            <Code2 size={12} /> {finding.language || "code"}
                                          </div>
                                          <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-5 text-emerald-100">
                                            {finding.suggested_code}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="mt-3 flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditingFinding(isEditing ? null : editKey)}
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                                >
                                  <Pencil size={12} /> {isEditing ? "Done" : "Edit"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateFinding(review, finding.id, { selected: !finding.selected })}
                                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                                >
                                  <X size={12} /> {finding.selected ? "Dismiss" : "Restore"}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {review.comment_url ? (
                          <a
                            href={review.comment_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-300/10"
                          >
                            View published review <ExternalLink size={14} />
                          </a>
                        ) : findingCount > 0 ? (
                          <button
                            type="button"
                            onClick={() => void publish(review)}
                            disabled={publishingId !== null || selectedCount === 0}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 text-xs font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {publishingId === review.id ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
                            {publishingId === review.id ? "Posting..." : `Post ${selectedCount} selected`}
                          </button>
                        ) : null}
                      </div>
                    )}

                    {canRegenerate && (
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                        <select
                          value={modes[review.id] ?? review.review_mode ?? "balanced"}
                          onChange={(event) => setModes((current) => ({
                            ...current,
                            [review.id]: event.target.value as ReviewMode,
                          }))}
                          className="rounded-lg border border-white/[0.08] bg-slate-950 px-3 py-2 text-xs text-slate-300 outline-none"
                        >
                          <option value="balanced">Balanced</option>
                          <option value="security">Security focus</option>
                          <option value="performance">Performance focus</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => void regenerate(review)}
                          disabled={retryingId !== null}
                          className="flex items-center justify-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60"
                        >
                          {retryingId === review.id ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCcw size={14} />}
                          {review.status === "failed" ? "Retry review" : "Review again"}
                        </button>
                      </div>
                    )}

                    {error?.id === review.id && (
                      <p className="mt-3 text-xs text-rose-300" role="alert">{error.message}</p>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {filteredReviews.length > pageSize && (
        <div className="flex items-center justify-between border-t border-white/[0.06] px-5 py-4 text-xs text-slate-500 sm:px-6">
          <span>Page {safePage} of {pageCount}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={safePage === 1}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={safePage === pageCount}
              className="rounded-lg border border-white/[0.08] px-3 py-1.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
