"use client";

import {
  CheckCircle2,
  ChevronDown,
  Github,
  LoaderCircle,
  Lock,
  Plus,
  Search,
  Save,
  Settings2,
  Trash2,
} from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ConnectedRepo, GitHubRepository } from "@/types";
import { getRepoSettings } from "@/lib/repo-settings";
import type { RepoSettings } from "@/types";

export function RepoManager({
  initialConnected,
  repositories,
}: {
  initialConnected: ConnectedRepo[];
  repositories: GitHubRepository[];
}) {
  const router = useRouter();
  const [connected, setConnected] = useState(initialConnected);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsRepoId, setSettingsRepoId] = useState<string | null>(null);
  const [settingsDrafts, setSettingsDrafts] = useState<Record<string, RepoSettings>>(() =>
    Object.fromEntries(initialConnected.map((repo) => [repo.id, getRepoSettings(repo)])),
  );
  const connectedIds = useMemo(() => new Set(connected.map((repo) => repo.github_repo_id)), [connected]);
  const available = repositories.filter(
    (repo) =>
      !connectedIds.has(repo.id) && repo.full_name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  async function connect(fullName: string) {
    setBusy(fullName);
    setError(null);
    try {
      const response = await fetch("/api/repos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const body = (await response.json()) as { connected?: ConnectedRepo; error?: string };
      if (!response.ok || !body.connected) throw new Error(body.error ?? "Could not connect repository");
      setConnected((current) => [body.connected!, ...current]);
      setPickerOpen(false);
      setQuery("");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not connect repository");
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(repo: ConnectedRepo) {
    if (!window.confirm(`Disconnect ${repo.full_name}? Its GitHub webhook and review history will be removed.`)) {
      return;
    }

    setBusy(repo.id);
    setError(null);
    try {
      const response = await fetch(`/api/repos/${repo.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Could not disconnect repository");
      }
      setConnected((current) => current.filter((candidate) => candidate.id !== repo.id));
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not disconnect repository");
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(repo: ConnectedRepo) {
    const settings = settingsDrafts[repo.id] ?? getRepoSettings(repo);
    setBusy(`settings:${repo.id}`);
    setError(null);
    try {
      const response = await fetch(`/api/repos/${repo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = (await response.json()) as { repository?: ConnectedRepo; error?: string };
      if (!response.ok || !body.repository) throw new Error(body.error ?? "Could not save settings");
      setConnected((current) => current.map((item) => item.id === repo.id ? body.repository! : item));
      setSettingsRepoId(null);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save settings");
    } finally {
      setBusy(null);
    }
  }

  function updateSettings(repo: ConnectedRepo, changes: Partial<RepoSettings>) {
    setSettingsDrafts((current) => ({
      ...current,
      [repo.id]: { ...(current[repo.id] ?? getRepoSettings(repo)), ...changes },
    }));
  }

  return (
    <section className="panel rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h2 className="font-medium text-white">Connected repositories</h2>
          <p className="mt-1 text-xs text-slate-500">PRs opened or updated here are reviewed automatically.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setPickerOpen((value) => !value);
            setError(null);
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
        >
          <Plus size={16} /> Connect repository <ChevronDown size={15} />
        </button>
      </div>

      {pickerOpen && (
        <div className="border-b border-white/[0.07] bg-black/10 p-5 sm:p-6">
          <label className="relative block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              autoFocus
              placeholder="Search your repositories…"
              className="w-full rounded-xl border border-white/10 bg-slate-950/70 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-300/40"
            />
          </label>
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {available.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-slate-500">No repositories found.</p>
            ) : (
              available.slice(0, 60).map((repo) => {
                const canConnect = Boolean(repo.permissions?.admin);
                return (
                  <button
                    key={repo.id}
                    type="button"
                    disabled={!canConnect || busy !== null}
                    onClick={() => void connect(repo.full_name)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/[0.07] bg-white/[0.03] text-slate-400">
                      {repo.private ? <Lock size={15} /> : <Github size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-200">{repo.full_name}</span>
                      <span className="block text-xs text-slate-600">
                        {canConnect ? `Default branch: ${repo.default_branch}` : "Admin access required"}
                      </span>
                    </span>
                    {busy === repo.full_name ? (
                      <LoaderCircle className="animate-spin text-emerald-300" size={17} />
                    ) : (
                      <Plus className="text-slate-600" size={17} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="border-b border-red-400/10 bg-red-400/[0.06] px-6 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}

      <div className="divide-y divide-white/[0.06]">
        {connected.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="mx-auto grid size-12 place-items-center rounded-2xl border border-dashed border-white/10 text-slate-600">
              <Github size={21} />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-300">No repositories connected</p>
            <p className="mt-1 text-xs text-slate-600">Connect one to install its pull request webhook.</p>
          </div>
        ) : (
          connected.map((repo) => {
            const settings = settingsDrafts[repo.id] ?? getRepoSettings(repo);
            return (
            <Fragment key={repo.id}>
            <div className="group flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-400">
                <Github size={17} />
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={`https://github.com/${repo.full_name}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-medium text-slate-200 transition hover:text-emerald-300"
                >
                  {repo.full_name}
                </a>
                <p className="mt-0.5 text-xs text-slate-600">{repo.default_branch} · Pull requests</p>
              </div>
              <span className="hidden items-center gap-1.5 text-xs text-emerald-300 sm:flex">
                <CheckCircle2 size={14} /> Active
              </span>
              <button
                type="button"
                onClick={() => setSettingsRepoId((current) => current === repo.id ? null : repo.id)}
                aria-label={`Settings for ${repo.full_name}`}
                title="Review settings"
                className="rounded-lg p-2 text-slate-600 transition hover:bg-white/[0.05] hover:text-slate-200"
              >
                <Settings2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => void disconnect(repo)}
                disabled={busy !== null}
                aria-label={`Disconnect ${repo.full_name}`}
                title="Disconnect"
                className="rounded-lg p-2 text-slate-700 transition hover:bg-red-400/10 hover:text-red-300 disabled:cursor-wait"
              >
                {busy === repo.id ? <LoaderCircle className="animate-spin" size={16} /> : <Trash2 size={16} />}
              </button>
            </div>
            {settingsRepoId === repo.id && (
              <div className="border-t border-white/[0.05] bg-black/10 px-5 py-5 sm:px-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    Review focus
                    <select
                      value={settings.review_mode}
                      onChange={(event) => updateSettings(repo, { review_mode: event.target.value as RepoSettings["review_mode"] })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none"
                    >
                      <option value="balanced">Balanced</option>
                      <option value="security">Security</option>
                      <option value="performance">Performance</option>
                    </select>
                  </label>
                  <label className="text-xs text-slate-500">
                    Minimum severity
                    <select
                      value={settings.minimum_severity}
                      onChange={(event) => updateSettings(repo, { minimum_severity: event.target.value as RepoSettings["minimum_severity"] })}
                      className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 outline-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                </div>
                <label className="mt-4 block text-xs text-slate-500">
                  Ignore paths (comma separated)
                  <input
                    value={settings.ignored_paths.join(", ")}
                    onChange={(event) => updateSettings(repo, {
                      ignored_paths: event.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                    })}
                    placeholder="package-lock.json, dist/*, generated/*"
                    className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-xs text-slate-200 outline-none"
                  />
                </label>
                <label className="mt-4 block text-xs text-slate-500">
                  Custom instructions
                  <textarea
                    value={settings.custom_instructions}
                    onChange={(event) => updateSettings(repo, { custom_instructions: event.target.value })}
                    rows={3}
                    placeholder="Example: Check API input validation carefully."
                    className="mt-1.5 w-full resize-y rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2.5 text-xs leading-5 text-slate-200 outline-none"
                  />
                </label>
                <div className="mt-4 flex flex-col gap-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.auto_review}
                        onChange={(event) => updateSettings(repo, { auto_review: event.target.checked })}
                        className="accent-emerald-300"
                      />
                      Review new PR updates
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.block_on_critical}
                        onChange={(event) => updateSettings(repo, { block_on_critical: event.target.checked })}
                        className="accent-emerald-300"
                      />
                      Fail status on critical issues
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => void saveSettings(repo)}
                    disabled={busy !== null}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-300 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:opacity-60"
                  >
                    {busy === `settings:${repo.id}` ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
                    Save settings
                  </button>
                </div>
              </div>
            )}
            </Fragment>
            );
          })
        )}
      </div>
    </section>
  );
}
