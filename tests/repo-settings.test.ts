import { describe, expect, it } from "vitest";

import { getRepoSettings } from "../lib/repo-settings";
import type { ConnectedRepo } from "../types";

function repo(overrides: Partial<ConnectedRepo> = {}): ConnectedRepo {
  return {
    id: "repo-1",
    user_id: "user-1",
    github_repo_id: 1,
    owner: "example",
    name: "project",
    full_name: "example/project",
    default_branch: "main",
    webhook_id: 1,
    webhook_active: true,
    created_at: "2026-09-06T00:00:00.000Z",
    updated_at: "2026-09-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("getRepoSettings", () => {
  it("uses safe defaults before the feature migration is installed", () => {
    expect(getRepoSettings(repo())).toMatchObject({
      review_mode: "balanced",
      minimum_severity: "low",
      auto_review: true,
      block_on_critical: false,
    });
  });

  it("keeps saved repository preferences", () => {
    expect(getRepoSettings(repo({ review_mode: "security", ignored_paths: ["dist/**"] }))).toMatchObject({
      review_mode: "security",
      ignored_paths: ["dist/**"],
    });
  });
});
