"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function HeaderNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [am, setAm] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          const j = await res.json();
          setAm(j?.am ?? null);
        } else {
          setAm(null);
        }
      } catch {
        setAm(null);
      }
    })();
  }, []);

  function isActive(href: string) {
    return href === "/"
      ? pathname === "/"
      : pathname.startsWith(href);
  }

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const linkCls = (href: string) =>
    `px-3 py-2 rounded-md text-sm ${isActive(href) ? "bg-white text-black" : "text-white/80 hover:text-white hover:bg-white/10"}`;

  return (
    <header className="sticky top-0 z-10 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
        <nav className="flex items-center gap-2">
          <Link href="/" className={linkCls("/")}>Accueil</Link>
          <Link href="/rr/overview" className={linkCls("/rr/overview")}>RR Abgleich</Link>
          <Link href="/leases" className={linkCls("/leases")}>Vue normale</Link>
        </nav>
        <div className="flex items-center gap-3">
          {am && <span className="rounded-full border border-white/20 px-2 py-1 text-xs text-white/80">AM: {am}</span>}
          <button
            onClick={onLogout}
            className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10"
            title="Se déconnecter"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
