export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadCsv, loadBridgeTenants, loadBridgeAssets } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import type { Row } from "@/lib/types";

type Line = {
  asset: string;
  tenantId: string;      // asset::slug
  tenantLabel: string;   // ex: "Netto"
  gla_m2?: number;
  rent_eur_pa?: number;
  walt_years?: number;
  lease_start?: string;
  lease_end?: string;
  options_text?: string;
  psm?: number;
};
type Result = {
  kpis: { tenants_total: number; rent_sum: number };
  lines: Line[];
};

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const month = "2025-09"; // ajuste au besoin
    const amRows = loadCsv("am", month); // AM only
    const owners = loadBridgeAssets();   // { "AA1":"CFR", ... }

    // filtrage par AM côté serveur (sauf ADMIN)
    const amFiltered = (sess.am === "ADMIN")
      ? amRows
      : amRows.filter(r => owners[(r.asset_code ?? "").trim()] === sess.am);

    const tenantNormalizer = makeTenantNormalizer(loadBridgeTenants());

    const lines: Line[] = amFiltered.map((r: Row) => {
      const asset = (r.asset_code ?? "").trim();
      const slug = tenantNormalizer.toCanonicalSlug(r.tenant_name ?? "");
      const label = tenantNormalizer.toCanonicalLabel(r.tenant_name ?? "");
      return {
        asset,
        tenantId: `${asset}::${slug}`,
        tenantLabel: label,
        gla_m2: r.gla_m2,
        rent_eur_pa: r.rent_eur_pa,
        walt_years: r.walt_years,
        lease_start: r.lease_start,
        lease_end: r.lease_end,
        options_text: r.options_text,
        psm: r.psm,
      };
    });

    const kpis = {
      tenants_total: lines.length,
      rent_sum: lines.reduce((s, l) => s + (Number(l.rent_eur_pa) || 0), 0),
    };

    const payload: Result = { kpis, lines };
    return NextResponse.json(payload);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e); // <-- la clé
    console.error("[/api/leases] ERROR:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
