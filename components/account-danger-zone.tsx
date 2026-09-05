"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { signOut } from "next-auth/react";
import { useState } from "react";

export function AccountDangerZone() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeAccount() {
    if (confirmation !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error("Account deletion failed");
      await signOut({ callbackUrl: "/" });
    } catch {
      setError("Your account could not be deleted. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-rose-300/10 bg-rose-300/[0.025] p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-medium text-slate-200">Account and privacy</h2>
          <p className="mt-1 text-xs text-slate-500">You can permanently remove your saved repositories, reviews, and account.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center justify-center gap-2 rounded-lg border border-rose-300/15 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-300/[0.07]"
        >
          <Trash2 size={14} /> Delete account
        </button>
      </div>
      {open && (
        <div className="mt-4 border-t border-rose-300/10 pt-4">
          <label className="text-xs text-slate-400">
            Type DELETE to confirm
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="mt-2 w-full max-w-sm rounded-lg border border-rose-300/15 bg-slate-950/70 px-3 py-2 text-sm text-white outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => void removeAccount()}
            disabled={busy || confirmation !== "DELETE"}
            className="mt-3 flex items-center gap-2 rounded-lg bg-rose-400 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Trash2 size={14} />}
            Permanently delete
          </button>
          {error && <p className="mt-2 text-xs text-rose-300" role="alert">{error}</p>}
        </div>
      )}
    </section>
  );
}
