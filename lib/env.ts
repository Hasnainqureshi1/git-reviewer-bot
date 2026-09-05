const serverVariables = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITHUB_WEBHOOK_SECRET",
  "GEMINI_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

export type ServerVariable = (typeof serverVariables)[number];

export function requireEnv(name: ServerVariable): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getMissingEnvironmentVariables(): ServerVariable[] {
  return serverVariables.filter((name) => !process.env[name]);
}
