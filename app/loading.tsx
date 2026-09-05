export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center">
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <span className="size-4 animate-spin rounded-full border-2 border-emerald-300/20 border-t-emerald-300" />
        Loading…
      </div>
    </main>
  );
}
