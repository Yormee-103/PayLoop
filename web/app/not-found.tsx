import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="card space-y-4">
        <h1 className="text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-slate-400">
          That page doesn&apos;t exist.
        </p>
        <Link href="/" className="btn-primary">
          Back home
        </Link>
      </div>
    </div>
  );
}
