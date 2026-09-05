# AI PR Reviewer

AI PR Reviewer connects to GitHub repositories, receives signed pull request webhooks, asks Gemini to review the changed code, and puts the findings in an approval dashboard. A maintainer decides when to post the review back to the PR.

## What is included

- GitHub OAuth with server-only JWT sessions
- AES-256-GCM encryption for GitHub access tokens at rest
- Repository discovery and webhook installation/removal
- HMAC-SHA256 webhook verification and delivery idempotency
- Background review processing with bounded, line-aware diff chunks
- Gemini retry handling and GitHub rate-limit feedback
- Supabase schema with RLS denying direct client access
- Responsive findings dashboard with manual GitHub publishing
- Structured finding cards with edit, dismiss, severity filters, and code fixes
- Inline GitHub review comments with a safe summary fallback
- Per-repository focus, severity, ignored paths, and merge-status settings
- GitHub App installation-token and Checks API support with OAuth fallback
- Daily usage limits, audit events, account deletion, and a privacy page
- Database-backed recovery jobs with a protected cron endpoint
- Unit tests for signature verification and diff chunking

## 1. Install and configure

```bash
npm install
cp .env.example .env.local
```

On PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if needed.

Generate the two secrets:

```bash
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 32      # TOKEN_ENCRYPTION_KEY
```

Generate a separate high-entropy value for `GITHUB_WEBHOOK_SECRET`. Never commit any of these values.

## 2. Create the Supabase schema

Create a Supabase project, open its SQL editor, and run these files in order:

1. [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
2. [`supabase/migrations/002_product_features.sql`](supabase/migrations/002_product_features.sql)

Copy the project URL and service-role key into `.env.local`. The service-role key is deliberately not prefixed with `NEXT_PUBLIC_`; it must only exist on the server. RLS is enabled without browser-facing policies because NextAuth, rather than Supabase Auth, owns the user session.

## 3. Create the GitHub OAuth App

In GitHub, go to **Settings → Developer settings → OAuth Apps → New OAuth App**.

For local development:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

Copy the client ID and client secret into `.env.local`. The requested OAuth scopes let the app read repositories, create repository webhooks, fetch private PR diffs, and post PR comments. A user must have repository admin access to connect a repo.

GitHub cannot deliver webhooks to localhost. For a real local PR test, expose port 3000 through an HTTPS tunnel and set `NEXTAUTH_URL` to that public origin before connecting the repository. Reconnect after changing the URL so the webhook configuration is updated.

Alternatively, keep `NEXTAUTH_URL=http://localhost:3000` for local OAuth and set `GITHUB_WEBHOOK_URL=https://your-public-domain/api/webhook/github`. When using the production Vercel endpoint this way, local and production must use the same Supabase project, `GITHUB_WEBHOOK_SECRET`, and `TOKEN_ENCRYPTION_KEY` so production can decrypt the stored GitHub token.

## 4. Add Gemini

Create an API key in Google AI Studio and set `GEMINI_API_KEY`. The default model is `gemini-3.7-flash`; override `GEMINI_MODEL` if that model is unavailable for your account or region.

## 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, connect a repository you administer, then open or update a pull request in that repository.

## Validation

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deploy to Vercel

1. Push the project to GitHub and import it into Vercel.
2. Add every variable from `.env.example` to the Vercel project.
3. Set `NEXTAUTH_URL` to the production HTTPS origin, without a trailing path.
4. Change the OAuth App homepage and callback URL to production (`https://your-domain/api/auth/callback/github`).
5. Deploy, sign in, and connect the test repository from the production dashboard.
6. Set `CRON_SECRET` to a random value so the recovery job can run.

The Vercel schedule runs once per day because Hobby projects do not support more frequent cron jobs. Webhooks still start reviews immediately. On a paid plan, change the schedule in `vercel.json` to every five minutes for faster recovery.

## Optional GitHub App migration

OAuth remains supported. For fine-grained repository access and GitHub check annotations, create a GitHub App and add `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, and `GITHUB_APP_PRIVATE_KEY`.

Give the GitHub App these repository permissions:

- Contents: read
- Metadata: read
- Pull requests: write
- Checks: write

Subscribe it to pull request events and set its webhook URL to `/api/webhook/github`. Install the app on the repositories you want to review, then reconnect them from the dashboard.

The webhook route acknowledges accepted events with HTTP 202 and uses Next.js `after()` for work that continues after the response. `maxDuration` is set to 60 seconds. For high-volume or very large production workloads, replace this in-process background work with a durable queue and a worker.

## Request flow

```text
GitHub pull_request webhook
  → verify raw-body HMAC signature
  → reserve X-GitHub-Delivery in Supabase
  → return 202 and process in the response lifecycle
  → fetch authenticated PR diff
  → chunk and review with Gemini
  → save findings for maintainer approval
  → maintainer clicks Post to GitHub
  → publish the approved issue comment on the PR
```

## Important operational notes

- Rotating `TOKEN_ENCRYPTION_KEY` requires re-authenticating all users unless stored tokens are re-encrypted first.
- Rotating `GITHUB_WEBHOOK_SECRET` requires reconnecting repositories so GitHub receives the new secret.
- The database uses a unique GitHub delivery ID to avoid duplicate reviews when a delivery is retried.
- Disconnecting a repository removes its GitHub webhook and cascades its local review history.
- AI output can be wrong, so findings are never posted until a maintainer explicitly approves them.
