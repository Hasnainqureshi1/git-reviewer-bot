import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  getConnectedRepoForUser,
  getGitHubTokenForUser,
  removeConnectedRepo,
} from "@/lib/database";
import { deleteWebhook, GitHubApiError } from "@/lib/github";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const repo = await getConnectedRepoForUser(id, session.user.id);
    if (!repo) return Response.json({ error: "Repository not found" }, { status: 404 });

    if (repo.webhook_id) {
      const accessToken = await getGitHubTokenForUser(session.user.id);
      try {
        await deleteWebhook(repo.owner, repo.name, repo.webhook_id, accessToken);
      } catch (error) {
        if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
      }
    }

    await removeConnectedRepo(repo.id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not disconnect repository", error);
    const message = error instanceof Error ? error.message : "Could not disconnect repository";
    return Response.json({ error: message }, { status: 500 });
  }
}
