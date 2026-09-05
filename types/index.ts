export type ReviewStatus = "pending" | "completed" | "failed";
export type ReviewSeverity = "critical" | "high" | "medium" | "low";
export type ReviewMode = "balanced" | "security" | "performance";

export interface ReviewFinding {
  id: string;
  severity: ReviewSeverity;
  title: string;
  path: string | null;
  line: number | null;
  problem: string;
  impact: string;
  fix: string;
  suggested_code: string | null;
  language: string | null;
}

export interface StructuredReview {
  version: 1;
  summary: string;
  findings: ReviewFinding[];
}

export interface RepoSettings {
  review_mode: ReviewMode;
  minimum_severity: ReviewSeverity;
  ignored_paths: string[];
  custom_instructions: string;
  auto_review: boolean;
  block_on_critical: boolean;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  owner: {
    login: string;
  };
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    pull?: boolean;
  };
}

export interface ConnectedRepo {
  id: string;
  user_id: string;
  github_repo_id: number;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  webhook_id: number | null;
  webhook_active: boolean;
  github_installation_id?: number | null;
  review_mode?: ReviewMode;
  minimum_severity?: ReviewSeverity;
  ignored_paths?: string[];
  custom_instructions?: string;
  auto_review?: boolean;
  block_on_critical?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReviewRecord {
  id: string;
  repo_id: string;
  github_delivery_id: string;
  pr_number: number;
  pr_title: string;
  pr_url: string;
  status: ReviewStatus;
  ai_response: string | null;
  comment_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  review_mode?: ReviewMode;
  attempt_count?: number;
  head_sha?: string | null;
  input_characters?: number;
  output_characters?: number;
  repos?: Pick<ConnectedRepo, "full_name"> | null;
}

export interface PullRequestWebhookPayload {
  action: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: { login: string };
  };
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    head: { sha: string };
  };
}
