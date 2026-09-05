import Link from "next/link";
import { GitPullRequestArrow } from "lucide-react";

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-white">
      <span className="grid size-9 place-items-center rounded-xl bg-emerald-300 text-slate-950 shadow-[0_0_30px_rgba(110,231,183,.2)]">
        <GitPullRequestArrow size={18} strokeWidth={2.3} />
      </span>
      <span>AI PR Reviewer</span>
    </Link>
  );
}
