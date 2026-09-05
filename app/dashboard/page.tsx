import { AlertTriangle, Bot, CheckCircle2, Clock3, ExternalLink, GitPullRequest } from "lucide-react";
import Image from "next/image";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { RepoManager } from "@/components/repo-manager";
import { SignOutButton } from "@/components/sign-out-button";
import { authOptions } from "@/lib/auth";
import { getConnectedRepos, getGitHubTokenForUser, getRecentReviews } from "@/lib/database";
import { listGitHubRepositories } from "@/lib/github";
import type { ConnectedRepo, GitHubRepository, ReviewRecord } from "@/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

const statusStyle = {
  completed: { label: "Completed", icon: CheckCircle2, className: "text-emerald-300 bg-emerald-300/10" },
  pending: { label: "Reviewing", icon: Clock3, className: "text-amber-300 bg-amber-300/10" },
  failed: { label: "Failed", icon: AlertTriangle, className: "text-red-300 bg-red-300/10" },
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  let connected: ConnectedRepo[] = [];
  let repositories: GitHubRepository[] = [];
  let reviews: ReviewRecord[] = [];
  let loadError: string | null = null;

  try {
    const [connectedResult, reviewsResult, token] = await Promise.all([
      getConnectedRepos(session.user.id),
      getRecentReviews(session.user.id),
      getGitHubTokenForUser(session.user.id),
    ]);
    connected = connectedResult;
    reviews = reviewsResult;
    repositories = await listGitHubRepositories(token);
  } catch (error) {
    console.error("Dashboard data failed to load", error);
    loadError = error instanceof Error ? error.message : "Dashboard data could not be loaded";
  }

  const completed = reviews.filter((review) => review.status === "completed").length;
  const pending = reviews.filter((review) => review.status === "pending").length;

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

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Repositories", connected.length, GitPullRequest, "Connected to GitHub"],
            ["Completed", completed, CheckCircle2, "Recent AI reviews"],
            ["In progress", pending, Clock3, "Currently processing"],
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

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
          <RepoManager initialConnected={connected} repositories={repositories} />

          <section className="panel overflow-hidden rounded-2xl">
            <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <h2 className="font-medium text-white">Recent reviews</h2>
              <p className="mt-1 text-xs text-slate-500">The latest 25 pull request events.</p>
            </div>
            <div className="max-h-[545px] divide-y divide-white/[0.06] overflow-y-auto">
              {reviews.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-600">
                    <Bot size={21} />
                  </div>
                  <p className="mt-4 text-sm font-medium text-slate-300">No reviews yet</p>
                  <p className="mt-1 text-xs text-slate-600">Open a PR in a connected repository to begin.</p>
                </div>
              ) : (
                reviews.map((review) => {
                  const status = statusStyle[review.status];
                  const StatusIcon = status.icon;
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
                            {review.comment_url && (
                              <a
                                href={review.comment_url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Open review comment"
                                className="shrink-0 text-slate-600 transition hover:text-white"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-slate-600">
                            {review.repos?.full_name} #{review.pr_number} · {formatDate(review.created_at)}
                          </p>
                          {review.status === "failed" && review.error_message && (
                            <p className="mt-2 line-clamp-2 text-xs leading-5 text-red-300/70">{review.error_message}</p>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
