"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => void signOut({ callbackUrl: "/" })}
      className="rounded-lg p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={17} />
    </button>
  );
}
