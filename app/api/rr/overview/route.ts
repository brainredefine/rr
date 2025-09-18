// app/api/rr/overview/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadCsv, loadBridgeTenants, loadBridgeAssets } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import type { Row } from "@/lib/types";

type DiffLine = {
  asset: string;
  city?: string; // ⬅️ NEW
  tenantId: string;
  tenantLabel: string;
  am?: { gla_m2: number; rent_eur_pa: number; walt_years: number };
  pm?: { gla_m2: number; rent_eur_pa: number; walt_years: number };
  delta?: { gla: number; rent: number; walt: number; gla_pct: number; rent_pct: number };
  status: "match" | "minor_mismatch" | "major_mismatch" | "missing_on_am" | "missing_on_pm";
};
type DiffResult = {
  kpis: { match_rate: number; tenants_total: number; tenants_mismatch: number; delta_rent_sum: number };
  lines: DiffLine[];
};

// 🔹 helper
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

    const owners = loadBridgeAssets();
    const tn = makeTenantNormalizer(loadBridgeTenants());
    const amAll = loadCsv("am", month);
    const pmAll = loadCsv("pm", month);
    
    // 🔹 filtrage par AM (sauf SUPER)
    const byOwner = (rows: Row[]) =>
      isSuper(sess) ? rows : rows.filter((r) => owners[(r.asset_code ?? "").trim()] === sess.am);

    const amRows = byOwner(amAll);
    const pmRows = byOwner(pmAll);
  // ⬇️ NEW: map asset → city (AM prioritaire)
  const assetCity = new Map<string, string>();
  for (const r of amRows) {
    const a = (r.asset_code ?? "").trim();
    const c = (r.city ?? "").trim();
    if (a && c && !assetCity.has(a)) assetCity.set(a, c);
  }
  for (const r of pmRows) {
    const a = (r.asset_code ?? "").trim();
    const c = (r.city ?? "").trim();
    if (a && c && !assetCity.has(a)) assetCity.set(a, c);
  }
    type AggVal = {
      asset: string;
      slug: string;
      label: string;
      gla_m2: number;
      rent_eur_pa: number;
      walt_years: number;
    };

    function aggregate(rows: Row[]) {
      const m = new Map<string, AggVal>();
      const add = (a: number | undefined, b: number | undefined) => (Number(a) || 0) + (Number(b) || 0);
      for (const r of rows) {
        const asset = (r.asset_code ?? "").trim();
        if (!asset) continue;
        const slug = tn.toCanonicalSlug(r.tenant_name ?? "");
        const label = tn.toCanonicalLabel(r.tenant_name ?? "");
        const key = `${asset}::${slug}`;
        const prev = m.get(key);
        if (prev) {
          prev.gla_m2 = add(prev.gla_m2, r.gla_m2);
          prev.rent_eur_pa = add(prev.rent_eur_pa, r.rent_eur_pa);
          prev.walt_years = add(prev.walt_years, r.walt_years);
        } else {
          m.set(key, {
            asset,
            slug,
            label,
            gla_m2: Number(r.gla_m2) || 0,
            rent_eur_pa: Number(r.rent_eur_pa) || 0,
            walt_years: Number(r.walt_years) || 0,
          });
        }
      }
      return m;
    }

    const amMap = aggregate(amRows);
    const pmMap = aggregate(pmRows);

    const keys = new Set<string>([...amMap.keys(), ...pmMap.keys()]);
    const lines: DiffLine[] = [];

    for (const key of keys) {
      const a = amMap.get(key);
      const p = pmMap.get(key);
      const [asset] = key.split("::");
      const city = assetCity.get(asset) ?? ""; // ⬅️ NEW
      const label =
        a?.label ??
        p?.label ??
        key.split("::")[1]?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
        key;

      const am = a ? { gla_m2: a.gla_m2, rent_eur_pa: a.rent_eur_pa, walt_years: a.walt_years } : undefined;
      const pm = p ? { gla_m2: p.gla_m2, rent_eur_pa: p.rent_eur_pa, walt_years: p.walt_years } : undefined;

      // exclure rent=0 des deux côtés
      const ra = Number(am?.rent_eur_pa ?? 0);
      const rp = Number(pm?.rent_eur_pa ?? 0);
      if (ra === 0 && rp === 0) continue;

      const delta_gla = Number(am?.gla_m2 ?? 0) - Number(pm?.gla_m2 ?? 0);
      const delta_rent = Number(am?.rent_eur_pa ?? 0) - Number(pm?.rent_eur_pa ?? 0);
      const delta_walt = Number(am?.walt_years ?? 0) - Number(pm?.walt_years ?? 0);

      const baseG = Number(pm?.gla_m2 ?? 0);
      const baseR = Number(pm?.rent_eur_pa ?? 0);
      const gla_pct = baseG ? delta_gla / baseG : 0;
      const rent_pct = baseR ? delta_rent / baseR : 0;
      
      let status: DiffLine["status"];
      if (!am && pm) status = "missing_on_am";
      else if (am && !pm) status = "missing_on_pm";
      else {
        const abs = Math.abs;
        const MINOR_PCT = 0.002;
        const MAJOR_PCT = 0.005;
        const MINOR_WALT = 1.5;
        const MAJOR_WALT = 50;
        const misG = baseG ? abs(delta_gla) / baseG : 0;
        const misR = baseR ? abs(delta_rent) / baseR : 0;
        const misW = abs(delta_walt);
        const major = misG >= MAJOR_PCT || misR >= MAJOR_PCT || misW >= MAJOR_WALT;
        const minor = !major && (misG >= MINOR_PCT || misR >= MINOR_PCT || misW >= MINOR_WALT);
        status = major ? "major_mismatch" : minor ? "minor_mismatch" : "match";
      }

      lines.push({
        asset,
        city, // ⬅️ NEW
        tenantId: key,
        tenantLabel: label,
        am,
        pm,
        delta: { gla: delta_gla, rent: delta_rent, walt: delta_walt, gla_pct, rent_pct },
        status,
      });
    }

    lines.sort((a, b) =>
      a.asset === b.asset
        ? (a.tenantLabel || a.tenantId).localeCompare(b.tenantLabel || b.tenantId)
        : a.asset.localeCompare(b.asset)
    );

    const tenants_total = lines.length;
    const tenants_mismatch = lines.filter((l) => l.status !== "match").length;
    const delta_rent_sum = lines.reduce((s, l) => s + (Number(l.delta?.rent) || 0), 0);
    const match_rate = tenants_total ? (tenants_total - tenants_mismatch) / tenants_total : 1;

    const kpis = { match_rate, tenants_total, tenants_mismatch, delta_rent_sum };
    return NextResponse.json({ kpis, lines, generated_at: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/rr/overview] ERROR:", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
