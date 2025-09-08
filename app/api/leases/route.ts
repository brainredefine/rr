// app/api/leases/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadCsv, loadBridgeTenants, loadBridgeAssets } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import type { Row } from "@/lib/types";

type Line = {
  asset: string;
  city?: string; // ⬅️ NEW
  tenantId: string;
  tenantLabel: string;
  gla_m2?: number;
  rent_eur_pa?: number;
  walt_years?: number;
  lease_start?: string;
  lease_end?: string;
  options_text?: string;
  psm?: number;
  receivables?: number;
};
type Result = {
  kpis: { tenants_total: number; rent_sum: number };
  lines: Line[];
};

// 🔹 helper: MGA ou ADMIN voient tout
function isSuper(sess: { am?: string; u?: string } | null) {
  return !!sess && (sess.am === "ADMIN" || sess.u === "MGA" || sess.am === "MGA");
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const month = process.env.DATA_MONTH ?? "2025-09";
    const amRows = loadCsv("am", month);
    const owners = loadBridgeAssets();

    // 🔹 filtrage par AM (sauf SUPER)
    const amFiltered = isSuper(sess)
      ? amRows
      : amRows.filter((r) => owners[(r.asset_code ?? "").trim()] === sess.am);

    const tenantNormalizer = makeTenantNormalizer(loadBridgeTenants());

    const lines: Line[] = amFiltered.map((r: Row) => {
      const asset = (r.asset_code ?? "").trim();
      const slug = tenantNormalizer.toCanonicalSlug(r.tenant_name ?? "");
      const label = tenantNormalizer.toCanonicalLabel(r.tenant_name ?? "");
      return {
        asset,
        city: r.city ?? "", // ⬅️ NEW
        tenantId: `${asset}::${slug}`,
        tenantLabel: label,
        gla_m2: r.gla_m2,
        rent_eur_pa: r.rent_eur_pa,
        walt_years: r.walt_years,
        lease_start: r.lease_start,
        lease_end: r.lease_end,
        options_text: r.options_text,
        psm: r.psm,
        receivables:r.receivables,
      };
    });

    const kpis = {
      tenants_total: lines.length,
      rent_sum: lines.reduce((s, l) => s + (Number(l.rent_eur_pa) || 0), 0),
    };

    const payload: Result = { kpis, lines };
    return NextResponse.json(payload);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/leases] ERROR:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
