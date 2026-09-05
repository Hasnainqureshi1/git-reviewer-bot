import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  deleteUserAccount,
  getConnectedRepos,
  getGitHubTokenForUser,
  logAuditEvent,
} from "@/lib/database";
import { deleteWebhook, GitHubApiError } from "@/lib/github";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const repos = await getConnectedRepos(session.user.id);
    const needsOAuthToken = repos.some((repo) => repo.webhook_id);
    const accessToken = needsOAuthToken ? await getGitHubTokenForUser(session.user.id) : null;

    for (const repo of repos) {
      if (!repo.webhook_id || !accessToken) continue;
      try {
        await deleteWebhook(repo.owner, repo.name, repo.webhook_id, accessToken);
      } catch (error) {
        if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
      }
    }

    await logAuditEvent({
      userId: session.user.id,
      action: "account.deleted",
      targetType: "user",
      targetId: session.user.id,
    });
    await deleteUserAccount(session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not delete account", error);
    return Response.json({ error: "Account could not be deleted" }, { status: 500 });
  }
}
