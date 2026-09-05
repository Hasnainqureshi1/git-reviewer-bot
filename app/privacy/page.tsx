import Link from "next/link";

import { Brand } from "@/components/brand";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <Brand />
        <Link href="/" className="text-sm text-slate-400 hover:text-white">Home</Link>
      </div>
      <article className="panel mt-10 rounded-2xl p-6 sm:p-8">
        <h1 className="text-3xl font-semibold text-white">Privacy policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: September 5, 2026</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-300">
          <section><h2 className="font-semibold text-white">Data we store</h2><p>We store your GitHub account name, connected repositories, encrypted GitHub token, pull request details, AI findings, settings, and basic usage records.</p></section>
          <section><h2 className="font-semibold text-white">How we use it</h2><p>We use this data only to read pull request changes, create AI reviews, show results, and post findings that you approve.</p></section>
          <section><h2 className="font-semibold text-white">Third-party services</h2><p>GitHub provides repository data, Gemini processes changed code, Supabase stores application data, and Vercel hosts the application.</p></section>
          <section><h2 className="font-semibold text-white">Your controls</h2><p>You can disconnect a repository or permanently delete your account and stored data from the dashboard.</p></section>
          <section><h2 className="font-semibold text-white">Security</h2><p>Access tokens are encrypted before storage. Secrets remain on the server. No AI finding is posted until a maintainer approves it.</p></section>
        </div>
      </article>
    </main>
  );
}
