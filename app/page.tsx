export const dynamic = "force-dynamic";

import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export default async function Page() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  const sess = await readSession(token);

  if (!sess) redirect("/login");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Welcome!</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/rr/overview"
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 hover:bg-neutral-800 transition"
        >
          <div className="text-lg font-medium">RR Abgleich</div>
          <p className="mt-1 text-sm text-neutral-400">
            AM vs PM + updated comments.
          </p>
        </Link>

        <Link
          href="/leases"
          className="rounded-lg border border-neutral-800 bg-neutral-900 p-6 hover:bg-neutral-800 transition"
        >
          <div className="text-lg font-medium">Normal view</div>
          <p className="mt-1 text-sm text-neutral-400">
            Personal notes, quick information, receivables (for each tenant).
          </p>
        </Link>
      </div>
    </main>
  );
}
