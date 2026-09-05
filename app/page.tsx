import { ArrowRight, Bot, Check, Github, ScanSearch, Webhook } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { Brand } from "@/components/brand";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="mesh pointer-events-none absolute inset-0" />
      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        <Brand />
        <Link
          href={session ? "/dashboard" : "/login"}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-emerald-300/30 hover:bg-white/[0.07]"
        >
          {session ? "Open dashboard" : "Sign in"}
          <ArrowRight size={15} />
        </Link>
      </nav>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-16 px-6 pb-24 pt-20 lg:grid-cols-[1.05fr_.95fr] lg:px-8 lg:pb-32 lg:pt-28">
        <div className="max-w-3xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.07] px-3 py-1.5 text-xs font-medium text-emerald-200">
            <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_#77e7c0]" />
            Thoughtful reviews, automatically
          </div>
          <h1 className="text-balance text-5xl font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
            Ship code with a second set of eyes.
          </h1>
          <p className="mt-7 max-w-xl text-pretty text-lg leading-8 text-slate-400">
            Connect a GitHub repository once. Every pull request gets a concise AI review for bugs,
            security risks, and maintainability issues—right where your team works.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href={session ? "/dashboard" : "/login"}
              className="soft-ring flex items-center justify-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200"
            >
              <Github size={18} />
              {session ? "Go to dashboard" : "Connect GitHub"}
            </Link>
            <a
              href="#how-it-works"
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5"
            >
              See how it works
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-500">
            {["Secure OAuth", "PR-native comments", "Review history"].map((item) => (
              <span key={item} className="flex items-center gap-1.5">
                <Check size={14} className="text-emerald-300" /> {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative lg:pt-4">
          <div className="absolute -inset-12 -z-10 rounded-full bg-emerald-400/5 blur-3xl" />
          <div className="panel overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-full bg-violet-400/10 text-violet-300">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">AI Review Bot</p>
                  <p className="text-xs text-slate-500">commented just now</p>
                </div>
              </div>
              <span className="rounded-md border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Review complete
              </span>
            </div>
            <div className="space-y-5 px-5 py-6 text-sm leading-6 text-slate-300 sm:px-7">
              <div>
                <p className="mb-2 font-medium text-amber-300">High · src/api/users.ts:42</p>
                <p>
                  The query interpolates <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-slate-200">userId</code> directly,
                  allowing crafted input to alter the SQL statement. Use a parameterized query.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4 font-mono text-xs leading-6">
                <span className="text-red-300/80">- db.query(`SELECT * FROM users WHERE id = ${"${userId}"}`)</span>
                <br />
                <span className="text-emerald-300/80">+ db.query(&quot;SELECT * FROM users WHERE id = $1&quot;, [userId])</span>
              </div>
              <div>
                <p className="mb-2 font-medium text-sky-300">Medium · src/cache.ts:18</p>
                <p>The error path leaves the lock held. Release it in a finally block to prevent stalled requests.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="relative z-10 border-t border-white/[0.07] bg-black/10">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">One simple loop</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">From opened PR to useful feedback.</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {[
              [Webhook, "GitHub signals", "A signed webhook fires when a pull request is opened or updated."],
              [ScanSearch, "Gemini reviews", "The changed code is securely fetched, chunked, and checked for actionable issues."],
              [Github, "Feedback lands", "A concise Markdown review is posted to the PR and saved to your dashboard."],
            ].map(([Icon, title, text], index) => {
              const CardIcon = Icon as typeof Webhook;
              return (
                <div key={String(title)} className="panel rounded-2xl p-6">
                  <div className="mb-7 flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-white/[0.05] text-emerald-300">
                      <CardIcon size={19} />
                    </span>
                    <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
                  </div>
                  <h3 className="font-medium text-white">{String(title)}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{String(text)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <footer className="relative z-10 border-t border-white/[0.07] px-6 py-6 text-center text-xs text-slate-600">
        <Link href="/privacy" className="transition hover:text-slate-300">Privacy and data controls</Link>
      </footer>
    </main>
  );
}
