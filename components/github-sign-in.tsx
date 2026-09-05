"use client";

import { Github, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function GitHubSignIn({ label = "Continue with GitHub" }: { label?: string }) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        setLoading(true);
        void signIn("github", { callbackUrl: "/dashboard" });
      }}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-75"
    >
      {loading ? <LoaderCircle className="animate-spin" size={18} /> : <Github size={18} />}
      {loading ? "Connecting…" : label}
    </button>
  );
}
