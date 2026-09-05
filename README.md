# AI PR Reviewer

AI PR Reviewer connects to GitHub repositories, receives signed pull request webhooks, asks Gemini to review the changed code, and posts the result back to the PR. Its dashboard tracks repository connections and recent review status.

## What is included

- GitHub OAuth with server-only JWT sessions
- AES-256-GCM encryption for GitHub access tokens at rest
- Repository discovery and webhook installation/removal
- HMAC-SHA256 webhook verification and delivery idempotency
- Background review processing with bounded, line-aware diff chunks
- Gemini retry handling and GitHub rate-limit feedback
- Supabase schema with RLS denying direct client access
- Responsive dashboard and review history
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

Create a Supabase project, open its SQL editor, and run [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql).

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

The webhook route acknowledges accepted events with HTTP 202 and uses Next.js `after()` for work that continues after the response. `maxDuration` is set to 60 seconds. For high-volume or very large production workloads, replace this in-process background work with a durable queue and a worker.

## Request flow

```text
GitHub pull_request webhook
  → verify raw-body HMAC signature
  → reserve X-GitHub-Delivery in Supabase
  → return 202 and process in the response lifecycle
  → fetch authenticated PR diff
  → chunk and review with Gemini
  → post an issue comment on the PR
  → mark the history row completed (or failed)
```

## Important operational notes

- Rotating `TOKEN_ENCRYPTION_KEY` requires re-authenticating all users unless stored tokens are re-encrypted first.
- Rotating `GITHUB_WEBHOOK_SECRET` requires reconnecting repositories so GitHub receives the new secret.
- The database uses a unique GitHub delivery ID to avoid duplicate comments when a delivery is retried.
- Disconnecting a repository removes its GitHub webhook and cascades its local review history.
- AI output can be wrong. The posted comment explicitly tells developers to verify suggestions.
