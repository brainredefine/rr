"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function linkCls(active: boolean) {
  return [
    "px-1.5 py-1 rounded",
    active ? "font-semibold text-white" : "text-neutral-300 hover:text-white",
  ].join(" ");
}

export default function NavLinks() {
  const pathname = usePathname();

  const isHome = pathname === "/";
  const isLeases = pathname === "/leases";
  const isRR = pathname === "/rr/overview";

  return (
    <nav className="hidden md:flex items-center gap-3 text-sm">
      <Link href="/" className={linkCls(isHome)}>Accueil</Link>
      <Link href="/leases" className={linkCls(isLeases)}>Vue normale</Link>
      <Link href="/rr/overview" className={linkCls(isRR)}>RR Abgleich</Link>
    </nav>
  );
}
