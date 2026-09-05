# Security

## Secret handling

- Never commit local environment files or paste production secrets into issues, pull requests, or chat.
- Rotate a secret immediately if it is exposed.
- Use separate secrets for local development and production.
- Keep all GitHub, Gemini, Supabase, authentication, encryption, webhook, and cron secrets server-only.
- After rotating the webhook secret, reconnect OAuth-managed repositories.
- Rotating the token encryption key requires users to sign in again unless tokens are re-encrypted first.

## Production checklist

- Run every Supabase migration in order.
- Use a GitHub App with the smallest required permissions.
- Configure daily usage limits and billing alerts.
- Review audit logs for account, repository, settings, retry, and publish actions.
- Test account deletion and webhook cleanup.
- Keep dependencies and the GitHub API version updated.
- Report suspected vulnerabilities privately to the project owner.
