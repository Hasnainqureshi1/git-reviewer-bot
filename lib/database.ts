import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { ConnectedRepo, GitHubRepository, ReviewRecord } from "@/types";

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
  webhookId: number,
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
    accessToken: await getGitHubTokenForUser(repo.user_id),
  };
}

export async function createPendingReview(input: {
  repoId: string;
  deliveryId: string;
  prNumber: number;
  prTitle: string;
  prUrl: string;
}): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
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
    .single();

  if (error?.code === "23505") return null;
  if (error) throw new Error(`Could not create review record: ${error.message}`);
  return data.id as string;
}

export async function completeReview(
  reviewId: string,
  aiResponse: string,
): Promise<void> {
  const { error } = await getSupabaseAdmin()
    .from("reviews")
    .update({
      status: "completed",
      ai_response: aiResponse,
      comment_url: null,
      error_message: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

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
    accessToken: await getGitHubTokenForUser(userId),
  };
}

export async function resetFailedReview(reviewId: string): Promise<boolean> {
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
    .eq("status", "failed")
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not retry review: ${error.message}`);
  return Boolean(data);
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
