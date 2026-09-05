import { AlertTriangle, CheckCircle2, Gauge, GitPullRequest, Send } from "lucide-react";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { AccountDangerZone } from "@/components/account-danger-zone";
import { RepoManager } from "@/components/repo-manager";
import { ReviewHistory } from "@/components/review-history";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import {
  getConnectedRepos,
  getGitHubTokenForUser,
  getRecentReviews,
  getReviewUsageSince,
} from "@/lib/database";
import { listGitHubRepositories } from "@/lib/github";
import { latestReviewAttempts } from "@/lib/reviews";
import { parseStoredReview } from "@/lib/structured-review";
import type { ConnectedRepo, GitHubRepository, ReviewRecord } from "@/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let connected: ConnectedRepo[] = [];
  let repositories: GitHubRepository[] = [];
  let reviews: ReviewRecord[] = [];
  let loadError: string | null = null;
  let dailyUsage = 0;
  let dailyTokens = 0;

  try {
    const [connectedResult, reviewsResult, token, usageResult] = await Promise.all([
      getConnectedRepos(session.user.id),
      getRecentReviews(session.user.id),
      getGitHubTokenForUser(session.user.id),
      getReviewUsageSince(
        session.user.id,
        new Date(Date.now() - 24 * 60 * 60 * 1_000).toISOString(),
      ),
    ]);
    connected = connectedResult;
    reviews = reviewsResult;
    repositories = await listGitHubRepositories(token);
    dailyUsage = usageResult.reviews;
    dailyTokens = usageResult.estimatedTokens;
  } catch (error) {
    console.error("Dashboard data failed to load", error);
    loadError = "Dashboard data could not be loaded. Please refresh and try again.";
  }

  const latestReviews = latestReviewAttempts(reviews);

  const awaitingApproval = latestReviews.filter(
    (review) =>
      review.status === "completed" &&
      !review.comment_url &&
      Boolean(parseStoredReview(review.ai_response)?.findings.length),
  ).length;
  const published = latestReviews.filter(
    (review) => review.status === "completed" && Boolean(review.comment_url),
  ).length;

  return (
    <main className="min-h-screen pb-16">
      <header className="border-b border-white/[0.07] bg-slate-950/40 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium text-slate-300">{session.user.name ?? session.user.githubLogin}</p>
              <p className="text-[11px] text-slate-600">@{session.user.githubLogin}</p>
            </div>
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt=""
                width={34}
                height={34}
                className="rounded-full border border-white/10"
              />
            ) : (
              <span className="grid size-9 place-items-center rounded-full bg-emerald-300 text-sm font-bold text-slate-950">
                {(session.user.name ?? "U").slice(0, 1).toUpperCase()}
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Overview</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Review operations</h1>
            <p className="mt-2 text-sm text-slate-500">Connect repositories and track every automated review.</p>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-600">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_8px_#77e7c0]" />
            Webhook listener active
          </p>
        </div>

        {loadError && (
          <div className="mt-7 flex gap-3 rounded-xl border border-red-400/15 bg-red-400/[0.06] p-4 text-sm text-red-200" role="alert">
            <AlertTriangle className="mt-0.5 shrink-0" size={17} />
            <div>
              <p className="font-medium">Dashboard setup needs attention</p>
              <p className="mt-1 text-xs text-red-300/70">{loadError}</p>
            </div>
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Repositories", connected.length, GitPullRequest, "Connected to GitHub"],
            ["Awaiting approval", awaitingApproval, Send, "Ready for your decision"],
            ["Published", published, CheckCircle2, "Posted to GitHub"],
            ["Daily usage", dailyUsage, Gauge, `~${dailyTokens.toLocaleString()} tokens · limit ${process.env.DAILY_REVIEW_LIMIT ?? "50"}`],
          ].map(([label, value, Icon, note]) => {
            const StatIcon = Icon as typeof GitPullRequest;
            return (
              <div key={String(label)} className="panel rounded-2xl p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500">{String(label)}</p>
                    <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{String(value)}</p>
                  </div>
                  <span className="grid size-9 place-items-center rounded-xl bg-white/[0.04] text-emerald-300">
                    <StatIcon size={17} />
                  </span>
                </div>
                <p className="mt-4 text-[11px] text-slate-600">{String(note)}</p>
              </div>
            );
          })}
        </section>

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(320px,.8fr)_minmax(0,1.2fr)]">
          <RepoManager initialConnected={connected} repositories={repositories} />

          <ReviewHistory initialReviews={latestReviews} />
        </div>

        <AccountDangerZone />
      </div>
    </main>
  );
}
