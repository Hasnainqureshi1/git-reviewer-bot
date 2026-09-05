export type ReviewStatus = "pending" | "completed" | "failed";

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
  };
}
