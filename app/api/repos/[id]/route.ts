import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import {
  getConnectedRepoForUser,
  getGitHubTokenForUser,
  logAuditEvent,
  removeConnectedRepo,
  updateRepoSettings,
} from "@/lib/database";
import { deleteWebhook, GitHubApiError } from "@/lib/github";

const settingsSchema = z.object({
  review_mode: z.enum(["balanced", "security", "performance"]),
  minimum_severity: z.enum(["low", "medium", "high", "critical"]),
  ignored_paths: z.array(z.string().trim().min(1).max(200)).max(50),
  custom_instructions: z.string().trim().max(1_000),
  auto_review: z.boolean(),
  block_on_critical: z.boolean(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = settingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the repository settings" }, { status: 400 });

  try {
    const { id } = await params;
    const repo = await getConnectedRepoForUser(id, session.user.id);
    if (!repo) return Response.json({ error: "Repository not found" }, { status: 404 });
    const updated = await updateRepoSettings(repo.id, session.user.id, parsed.data);
    await logAuditEvent({
      userId: session.user.id,
      action: "repository.settings_updated",
      targetType: "repository",
      targetId: repo.id,
    });
    return Response.json({ repository: updated });
  } catch (error) {
    console.error("Could not update repository settings", error);
    return Response.json(
      { error: "Could not save settings. Make sure the latest database migration is installed." },
      { status: 500 },
    );
  }
}

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

    await logAuditEvent({
      userId: session.user.id,
      action: "repository.disconnected",
      targetType: "repository",
      targetId: repo.id,
      metadata: { fullName: repo.full_name },
    });
    await removeConnectedRepo(repo.id, session.user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Could not disconnect repository", error);
    const message = error instanceof Error ? error.message : "Could not disconnect repository";
    return Response.json({ error: message }, { status: 500 });
  }
}
