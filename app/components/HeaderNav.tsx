export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import Link from "next/link";
import LogoutButton from "./LogoutButton";
import NavLinks from "./NavLinks"; // ⬅️ client component

export default async function HeaderNav() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value ?? null;
  const sess = await readSession(token);

  const am = sess?.am ?? null;
  const user = sess?.u ?? null;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        {/* Nav uniquement (plus de “Welcome”) */}
        <NavLinks />

        <div className="flex items-center gap-3 text-sm">
          {am ? (
            <>
              <span className="text-neutral-400">
                AM: <span className="text-white">{am}</span>
                {user ? <span className="text-neutral-500"> — {user}</span> : null}
              </span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded bg-white/10 px-3 py-1.5 hover:bg-white/15"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
