import { ArrowLeft, LockKeyhole } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { GitHubSignIn } from "@/components/github-sign-in";
import { authOptions } from "@/lib/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session) redirect("/dashboard");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6 py-16">
      <div className="mesh pointer-events-none absolute inset-0" />
      <Link
        href="/"
        className="absolute left-6 top-6 flex items-center gap-2 text-sm text-slate-500 transition hover:text-white lg:left-8"
      >
        <ArrowLeft size={16} /> Back
      </Link>
      <section className="panel relative z-10 w-full max-w-md rounded-3xl p-7 sm:p-9">
        <Brand />
        <div className="mb-8 mt-10">
          <h1 className="text-3xl font-semibold tracking-tight text-white">Welcome aboard.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Sign in to choose repositories and start reviewing pull requests automatically.
          </p>
        </div>
        <GitHubSignIn />
        <div className="mt-6 flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.025] p-4">
          <LockKeyhole className="mt-0.5 shrink-0 text-emerald-300" size={16} />
          <p className="text-xs leading-5 text-slate-500">
            Your GitHub token is encrypted before storage and is never sent to the browser.
          </p>
        </div>
      </section>
    </main>
  );
}
