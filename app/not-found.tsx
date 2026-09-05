import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-emerald-300">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">That page slipped the diff.</h1>
        <Link href="/" className="mt-6 inline-block text-sm text-slate-400 underline underline-offset-4 hover:text-white">
          Return home
        </Link>
      </div>
    </main>
  );
}
