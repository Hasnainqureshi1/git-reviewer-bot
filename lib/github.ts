import type { GitHubRepository } from "@/types";

const API_ROOT = "https://api.github.com";

export class GitHubApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly rateLimitReset?: string | null,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

async function githubRequest<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": process.env.GITHUB_API_VERSION ?? "2022-11-28",
      "User-Agent": "ai-pr-reviewer",
      ...init.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = (await response.json()) as { message?: string };
      detail = body.message ?? detail;
    } catch {
      // GitHub occasionally returns an empty or non-JSON error body.
    }

    const rateLimited = response.status === 403 && response.headers.get("x-ratelimit-remaining") === "0";
    const message = rateLimited
      ? `GitHub API rate limit reached. Try again after ${response.headers.get("x-ratelimit-reset") ?? "the reset window"}.`
      : `GitHub API request failed (${response.status}): ${detail}`;

    throw new GitHubApiError(message, response.status, response.headers.get("x-ratelimit-reset"));
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listGitHubRepositories(accessToken: string): Promise<GitHubRepository[]> {
  const repositories: GitHubRepository[] = [];

  for (let page = 1; page <= 3; page += 1) {
    const batch = await githubRequest<GitHubRepository[]>(
      `/user/repos?visibility=all&affiliation=owner,collaborator,organization_member&sort=updated&per_page=100&page=${page}`,
      accessToken,
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }

  return repositories;
}

interface RepositoryWebhook {
  id: number;
  active: boolean;
  events: string[];
  config: { url?: string };
}

export async function createOrUpdateWebhook(
  owner: string,
  repo: string,
  accessToken: string,
  callbackUrl: string,
  secret: string,
): Promise<number> {
  const path = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks`;
  const hooks = await githubRequest<RepositoryWebhook[]>(`${path}?per_page=100`, accessToken);
  const existing = hooks.find((hook) => hook.config.url === callbackUrl);
  const body = JSON.stringify({
    name: "web",
    active: true,
    events: ["pull_request"],
    config: {
      url: callbackUrl,
      content_type: "json",
      secret,
      insecure_ssl: "0",
    },
  });

  if (existing) {
    const updated = await githubRequest<RepositoryWebhook>(`${path}/${existing.id}`, accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body,
    });
    return updated.id;
  }

  const created = await githubRequest<RepositoryWebhook>(path, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  return created.id;
}

export async function deleteWebhook(
  owner: string,
  repo: string,
  webhookId: number,
  accessToken: string,
): Promise<void> {
  await githubRequest<void>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/hooks/${webhookId}`,
    accessToken,
    { method: "DELETE" },
  );
}

export async function fetchPullRequestDiff(
  owner: string,
  repo: string,
  pullNumber: number,
  accessToken: string,
): Promise<string> {
  const response = await fetch(
    `${API_ROOT}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pullNumber}`,
    {
      headers: {
        Accept: "application/vnd.github.diff",
        Authorization: `Bearer ${accessToken}`,
        "X-GitHub-Api-Version": process.env.GITHUB_API_VERSION ?? "2022-11-28",
        "User-Agent": "ai-pr-reviewer",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new GitHubApiError(`Could not fetch pull request diff (${response.status}).`, response.status);
  }

  return response.text();
}

export async function postPullRequestComment(
  owner: string,
  repo: string,
  pullNumber: number,
  accessToken: string,
  body: string,
): Promise<string> {
  const response = await githubRequest<{ html_url: string }>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${pullNumber}/comments`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.slice(0, 65_000) }),
    },
  );

  return response.html_url;
}
