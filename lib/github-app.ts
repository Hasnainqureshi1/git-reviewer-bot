import { createSign } from "node:crypto";

const API_ROOT = "https://api.github.com";

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function isGitHubAppConfigured(): boolean {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

function createAppJwt(): string {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!appId || !privateKey) throw new Error("GitHub App credentials are not configured");

  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: appId }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

async function appRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${createAppJwt()}`,
      "X-GitHub-Api-Version": process.env.GITHUB_API_VERSION ?? "2022-11-28",
      "User-Agent": "ai-pr-reviewer",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`GitHub App request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export async function findGitHubAppInstallation(
  owner: string,
  repo: string,
): Promise<number | null> {
  if (!isGitHubAppConfigured()) return null;
  try {
    const installation = await appRequest<{ id: number }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`,
    );
    return installation.id;
  } catch {
    return null;
  }
}

export async function getInstallationAccessToken(installationId: number): Promise<string> {
  const token = await appRequest<{ token: string }>(
    `/app/installations/${installationId}/access_tokens`,
    { method: "POST" },
  );
  return token.token;
}
