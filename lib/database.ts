import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getInstallationAccessToken } from "@/lib/github-app";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ConnectedRepo, GitHubRepository, ReviewRecord } from "@/types";
import type { RepoSettings, ReviewMode } from "@/types";

export async function upsertGitHubUser(input: {
  githubId: number;
  githubLogin: string;
  avatarUrl?: string | null;
  accessToken: string;
}): Promise<{ id: string; github_login: string }> {
  const encrypted = encryptSecret(input.accessToken);
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .upsert(
      {
        github_id: input.githubId,
        github_login: input.githubLogin,
        avatar_url: input.avatarUrl ?? null,
        encrypted_access_token: encrypted.ciphertext,
        token_iv: encrypted.iv,
        token_auth_tag: encrypted.authTag,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "github_id" },
    )
    .select("id, github_login")
    .single();

  if (error) throw new Error(`Could not save GitHub account: ${error.message}`);
  return data;
}

export async function getGitHubTokenForUser(userId: string): Promise<string> {
  const { data, error } = await getSupabaseAdmin()
    .from("users")
    .select("encrypted_access_token, token_iv, token_auth_tag")
    .eq("id", userId)
    .single();

  if (error || !data) throw new Error("GitHub credentials were not found. Sign in again.");

  return decryptSecret({
    ciphertext: data.encrypted_access_token,
    iv: data.token_iv,
    authTag: data.token_auth_tag,
  });
}

export async function getConnectedRepos(userId: string): Promise<ConnectedRepo[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("repos")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Could not load connected repositories: ${error.message}`);
  return (data ?? []) as ConnectedRepo[];
}

export async function connectRepository(
  userId: string,
  repository: GitHubRepository,
  webhookId: number | null,
  installationId?: number | null,
): Promise<ConnectedRepo> {
  const admin = getSupabaseAdmin();
  const { data: existing, error: findError } = await admin
    .from("repos")
    .select("id, user_id")
    .eq("github_repo_id", repository.id)
    .maybeSingle();

  if (findError) throw new Error(`Could not check repository connection: ${findError.message}`);
  if (existing && existing.user_id !== userId) {
    throw new Error("This repository is already connected to another account.");
  }

  const record = {
    user_id: userId,
    github_repo_id: repository.id,
    owner: repository.owner.login,
    name: repository.name,
    full_name: repository.full_name,
    default_branch: repository.default_branch,
    webhook_id: webhookId,
    webhook_active: true,
    ...(installationId ? { github_installation_id: installationId } : {}),
    updated_at: new Date().toISOString(),
  };

  const query = existing
    ? admin.from("repos").update(record).eq("id", existing.id)
    : admin.from("repos").insert(record);
  const { data, error } = await query.select("*").single();

  if (error) throw new Error(`Could not save repository connection: ${error.message}`);
  return data as ConnectedRepo;
}

export async function getConnectedRepoForUser(
  id: string,
  userId: string,
): Promise<ConnectedRepo | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("repos")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load repository: ${error.message}`);
  return data as ConnectedRepo | null;
}

export async function removeConnectedRepo(id: string, userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("repos")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw new Error(`Could not remove repository: ${error.message}`);
}

export async function getRecentReviews(userId: string): Promise<ReviewRecord[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("reviews")
    .select("*, repos!inner(full_name, user_id)")
    .eq("repos.user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw new Error(`Could not load review history: ${error.message}`);
  return (data ?? []) as unknown as ReviewRecord[];
}

export async function findWebhookRepository(githubRepoId: number): Promise<{
  repo: ConnectedRepo;
  accessToken: string;
  usesGitHubApp: boolean;
} | null> {
  const { data: repo, error } = await getSupabaseAdmin()
    .from("repos")
    .select("*")
    .eq("github_repo_id", githubRepoId)
    .eq("webhook_active", true)
    .maybeSingle();

  if (error) throw new Error(`Could not resolve webhook repository: ${error.message}`);
  if (!repo) return null;

  return {
    repo: repo as ConnectedRepo,
    accessToken: repo.github_installation_id
      ? await getInstallationAccessToken(repo.github_installation_id)
      : await getGitHubTokenForUser(repo.user_id),
    usesGitHubApp: Boolean(repo.github_installation_id),
  };
}

export async function createPendingReview(input: {
  repoId: string;
  deliveryId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
  headSha?: string;
  reviewMode?: ReviewMode;
}): Promise<string | null> {
  const enhancedRecord = {
    repo_id: input.repoId,
    github_delivery_id: input.deliveryId,
    pr_number: input.prNumber,
    pr_title: input.prTitle,
    pr_url: input.prUrl,
    status: "pending",
    head_sha: input.headSha ?? null,
    review_mode: input.reviewMode ?? "balanced",
  };
  let { data, error } = await getSupabaseAdmin()
    .from("reviews")
    .insert(enhancedRecord)
    .select("id")
    .single();

  if (error && /head_sha|review_mode|schema cache/i.test(error.message)) {
    ({ data, error } = await getSupabaseAdmin()
      .from("reviews")
      .insert({
        repo_id: input.repoId,
        github_delivery_id: input.deliveryId,
        pr_number: input.prNumber,
        pr_title: input.prTitle,
        pr_url: input.prUrl,
        status: "pending",
      })
      .select("id")
      .single());
  }

  if (error?.code === "23505") return null;
  if (error) throw new Error(`Could not create review record: ${error.message}`);
  if (!data) throw new Error("Could not create review record");
  return data.id as string;
}

export async function completeReview(
  reviewId: string,
  aiResponse: string,
  usage?: { inputCharacters: number; outputCharacters: number },
): Promise<void> {
  let { error } = await getSupabaseAdmin()
    .from("reviews")
    .update({
      status: "completed",
      ai_response: aiResponse,
      comment_url: null,
      error_message: null,
      completed_at: new Date().toISOString(),
      input_characters: usage?.inputCharacters ?? 0,
      output_characters: usage?.outputCharacters ?? aiResponse.length,
    })
    .eq("id", reviewId);

  if (error && /input_characters|output_characters|schema cache/i.test(error.message)) {
    ({ error } = await getSupabaseAdmin()
      .from("reviews")
      .update({
        status: "completed",
        ai_response: aiResponse,
        comment_url: null,
        error_message: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", reviewId));
  }

  if (error) throw new Error(`Could not complete review record: ${error.message}`);
}

export async function getReviewForPublishing(
  reviewId: string,
  userId: string,
): Promise<{ review: ReviewRecord; repo: ConnectedRepo; accessToken: string } | null> {
  const { data: review, error } = await getSupabaseAdmin()
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .maybeSingle();

  if (error) throw new Error(`Could not load review: ${error.message}`);
  if (!review) return null;

  const repo = await getConnectedRepoForUser(review.repo_id, userId);
  if (!repo) return null;

  return {
    review: review as ReviewRecord,
    repo,
    accessToken: repo.github_installation_id
      ? await getInstallationAccessToken(repo.github_installation_id)
      : await getGitHubTokenForUser(userId),
  };
}

export async function resetReviewForProcessing(reviewId: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("reviews")
    .update({
      status: "pending",
      ai_response: null,
      comment_url: null,
      error_message: null,
      completed_at: null,
    })
    .eq("id", reviewId)
    .neq("status", "pending")
    .is("comment_url", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not retry review: ${error.message}`);
  return Boolean(data);
}

export async function updateRepoSettings(
  repoId: string,
  userId: string,
  settings: RepoSettings,
): Promise<ConnectedRepo> {
  const { data, error } = await getSupabaseAdmin()
    .from("repos")
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq("id", repoId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) throw new Error(`Could not save repository settings: ${error.message}`);
  return data as ConnectedRepo;
}

export async function countReviewsSince(userId: string, since: string): Promise<number> {
  const { count, error } = await getSupabaseAdmin()
    .from("reviews")
    .select("id, repos!inner(user_id)", { count: "exact", head: true })
    .eq("repos.user_id", userId)
    .gte("created_at", since);

  if (error) throw new Error(`Could not load review usage: ${error.message}`);
  return count ?? 0;
}

export async function getReviewUsageSince(userId: string, since: string): Promise<{
  reviews: number;
  estimatedTokens: number;
}> {
  const { data, error } = await getSupabaseAdmin()
    .from("reviews")
    .select("input_characters, output_characters, repos!inner(user_id)")
    .eq("repos.user_id", userId)
    .gte("created_at", since);

  if (error && /input_characters|output_characters|schema cache/i.test(error.message)) {
    return { reviews: await countReviewsSince(userId, since), estimatedTokens: 0 };
  }
  if (error) throw new Error(`Could not load review usage: ${error.message}`);
  const characters = (data ?? []).reduce(
    (total, item) => total + Number(item.input_characters ?? 0) + Number(item.output_characters ?? 0),
    0,
  );
  return { reviews: data?.length ?? 0, estimatedTokens: Math.ceil(characters / 4) };
}

export async function logAuditEvent(input: {
  userId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await getSupabaseAdmin().from("audit_logs").insert({
    user_id: input.userId ?? null,
    action: input.action,
    target_type: input.targetType,
    target_id: input.targetId ?? null,
    metadata: input.metadata ?? {},
  });

  if (error && !/audit_logs|schema cache|does not exist/i.test(error.message)) {
    console.error("Could not write audit log", error);
  }
}

export async function deleteUserAccount(userId: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("users").delete().eq("id", userId);
  if (error) throw new Error(`Could not delete account: ${error.message}`);
}

export async function startReviewJob(reviewId: string): Promise<boolean> {
  const { error } = await getSupabaseAdmin().from("review_jobs").upsert(
    {
      review_id: reviewId,
      status: "processing",
      attempt_count: 1,
      processing_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "review_id" },
  );

  if (error && /review_jobs|schema cache|does not exist/i.test(error.message)) return false;
  if (error) throw new Error(`Could not start review job: ${error.message}`);
  return true;
}

export async function finishReviewJob(
  reviewId: string,
  status: "completed" | "failed",
  errorMessage?: string,
): Promise<void> {
  const nextAttempt = new Date(Date.now() + 2 * 60 * 1_000).toISOString();
  const { error } = await getSupabaseAdmin()
    .from("review_jobs")
    .update({
      status,
      last_error: errorMessage?.slice(0, 1_000) ?? null,
      next_attempt_at: nextAttempt,
      processing_started_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("review_id", reviewId);

  if (error && !/review_jobs|schema cache|does not exist/i.test(error.message)) {
    console.error("Could not finish review job", error);
  }
}

export async function claimReviewJobs(limit = 5): Promise<Array<{ review_id: string }>> {
  const { data, error } = await getSupabaseAdmin().rpc("claim_review_jobs", {
    batch_size: Math.max(1, Math.min(limit, 10)),
  });
  if (error && /claim_review_jobs|schema cache|does not exist/i.test(error.message)) return [];
  if (error) throw new Error(`Could not claim review jobs: ${error.message}`);
  return (data ?? []) as Array<{ review_id: string }>;
}

export async function getReviewJobContext(reviewId: string): Promise<{
  review: ReviewRecord;
  repo: ConnectedRepo;
  accessToken: string;
} | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("reviews")
    .select("*, repos!inner(*)")
    .eq("id", reviewId)
    .maybeSingle();
  if (error) throw new Error(`Could not load review job: ${error.message}`);
  if (!data) return null;

  const review = data as unknown as ReviewRecord & { repos: ConnectedRepo };
  return {
    review,
    repo: review.repos,
    accessToken: review.repos.github_installation_id
      ? await getInstallationAccessToken(review.repos.github_installation_id)
      : await getGitHubTokenForUser(review.repos.user_id),
  };
}

export async function markReviewPublished(reviewId: string, commentUrl: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("reviews")
    .update({ comment_url: commentUrl })
    .eq("id", reviewId);

  if (error) throw new Error(`Could not save published comment: ${error.message}`);
}

export async function failReview(reviewId: string, reason: string): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("reviews")
    .update({
      status: "failed",
      error_message: reason.slice(0, 2_000),
      completed_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (error) console.error("Could not mark review as failed", error);
}
