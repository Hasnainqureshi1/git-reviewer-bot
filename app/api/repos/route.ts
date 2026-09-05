import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { connectRepository, getConnectedRepos, getGitHubTokenForUser } from "@/lib/database";
import { requireEnv } from "@/lib/env";
import {
  createOrUpdateWebhook,
  GitHubApiError,
  listGitHubRepositories,
} from "@/lib/github";

const connectSchema = z.object({
  fullName: z.string().regex(/^[^/\s]+\/[^/\s]+$/, "Choose a valid repository"),
});

function errorResponse(error: unknown) {
  console.error("Repository API error", error);
  if (error instanceof GitHubApiError) {
    return Response.json({ error: error.message }, { status: error.status === 403 ? 429 : error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected repository error";
  return Response.json({ error: message }, { status: 500 });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [connected, token] = await Promise.all([
      getConnectedRepos(session.user.id),
      getGitHubTokenForUser(session.user.id),
    ]);
    const repositories = await listGitHubRepositories(token);
    return Response.json({ connected, repositories });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = connectSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message }, { status: 400 });

  try {
    const accessToken = await getGitHubTokenForUser(session.user.id);
    const repositories = await listGitHubRepositories(accessToken);
    const repository = repositories.find(
      (candidate) => candidate.full_name.toLowerCase() === parsed.data.fullName.toLowerCase(),
    );

    if (!repository) return Response.json({ error: "Repository is not accessible" }, { status: 404 });
    if (!repository.permissions?.admin) {
      return Response.json({ error: "GitHub admin access is required to create a webhook" }, { status: 403 });
    }

    const callbackUrl = new URL("/api/webhook/github", requireEnv("NEXTAUTH_URL")).toString();
    const webhookId = await createOrUpdateWebhook(
      repository.owner.login,
      repository.name,
      accessToken,
      callbackUrl,
      requireEnv("GITHUB_WEBHOOK_SECRET"),
    );
    const connected = await connectRepository(session.user.id, repository, webhookId);

    return Response.json({ connected }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
