import type { ConnectedRepo, RepoSettings } from "@/types";

export const DEFAULT_REPO_SETTINGS: RepoSettings = {
  review_mode: "balanced",
  minimum_severity: "low",
  ignored_paths: [],
  custom_instructions: "",
  auto_review: true,
  block_on_critical: false,
};

export function getRepoSettings(repo: ConnectedRepo): RepoSettings {
  return {
    review_mode: repo.review_mode ?? DEFAULT_REPO_SETTINGS.review_mode,
    minimum_severity: repo.minimum_severity ?? DEFAULT_REPO_SETTINGS.minimum_severity,
    ignored_paths: Array.isArray(repo.ignored_paths) ? repo.ignored_paths : [],
    custom_instructions: repo.custom_instructions ?? "",
    auto_review: repo.auto_review ?? true,
    block_on_critical: repo.block_on_critical ?? false,
  };
}
