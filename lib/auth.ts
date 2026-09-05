import type { NextAuthOptions } from "next-auth";
import GitHubProvider, { type GithubProfile } from "next-auth/providers/github";

import { upsertGitHubUser } from "@/lib/database";

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
      authorization: {
        params: { scope: "read:user user:email repo admin:repo_hook" },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account?.provider === "github" && account.access_token && profile) {
        const githubProfile = profile as GithubProfile;
        const user = await upsertGitHubUser({
          githubId: Number(account.providerAccountId),
          githubLogin: githubProfile.login,
          avatarUrl: githubProfile.avatar_url,
          accessToken: account.access_token,
        });
        token.userId = user.id;
        token.githubLogin = user.github_login;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId;
        session.user.githubLogin = token.githubLogin;
      }
      return session;
    },
  },
};
