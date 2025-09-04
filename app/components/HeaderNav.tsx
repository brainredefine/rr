// app/components/HeaderNav.tsx (client component)
"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function HeaderNav() {
  const pathname = usePathname();
  const [commentCount, setCommentCount] = useState<number | null>(null);

  useEffect(() => {
    // Only fetch on RR pages
    if (!pathname.startsWith("/rr")) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/comments");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { items: Record<string, string> } = await res.json();
        if (!cancelled) setCommentCount(Object.keys(json.items ?? {}).length);
      } catch (e) {
        // optional: log or ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav className="...">
      {/* your links */}
      {/* optionally show the badge only on RR */}
      {/* {pathname.startsWith("/rr") && commentCount !== null && <span>{commentCount}</span>} */}
    </nav>
  );
}
