// app/api/rr/[asset]/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadCsv, loadBridgeTenants, loadBridgeAssets } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import type { Row } from "@/lib/types";

type Side = { gla_m2: number; rent_eur_pa: number; walt_years: number };
type Status =
  | "match"
  | "minor_mismatch"
  | "major_mismatch"
  | "missing_on_am"
  | "missing_on_pm";

type DiffLine = {
  tenantId: string;
  tenantLabel?: string;
  am?: Side;
  pm?: Side;
  delta?: { gla: number; rent: number; walt: number };
  status: Status;
};

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ asset: string }> } // ← attendu par ton Next sur Vercel
) {
  try {
    const { asset } = await context.params; // ← on attend ici

    // Auth
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const month = process.env.DATA_MONTH ?? "2025-09";
    const owners = loadBridgeAssets();
    const tn = makeTenantNormalizer(loadBridgeTenants());

    const byOwner = (rows: Row[]) =>
      sess.am === "ADMIN"
        ? rows
        : rows.filter((r) => owners[(r.asset_code ?? "").trim()] === sess.am);

    const amRows = byOwner(loadCsv("am", month)).filter(
      (r) => (r.asset_code ?? "").trim() === asset
    );
    const pmRows = byOwner(loadCsv("pm", month)).filter(
      (r) => (r.asset_code ?? "").trim() === asset
    );

    type AggVal = {
      slug: string;
      label: string;
      gla_m2: number;
      rent_eur_pa: number;
      walt_years: number;
    };

    const aggregate = (rows: Row[]) => {
      const m = new Map<string, AggVal>();
      const add = (a?: number, b?: number) => (Number(a) || 0) + (Number(b) || 0);
      for (const r of rows) {
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
            slug,
            label,
            gla_m2: Number(r.gla_m2) || 0,
            rent_eur_pa: Number(r.rent_eur_pa) || 0,
            walt_years: Number(r.walt_years) || 0,
          });
        }
      }
      return m;
    };

    const amMap = aggregate(amRows);
    const pmMap = aggregate(pmRows);

    const keys = new Set<string>([...amMap.keys(), ...pmMap.keys()]);
    const lines: DiffLine[] = [];

    for (const key of keys) {
      const a = amMap.get(key);
      const p = pmMap.get(key);

      const am = a
        ? { gla_m2: a.gla_m2, rent_eur_pa: a.rent_eur_pa, walt_years: a.walt_years }
        : undefined;
      const pm = p
        ? { gla_m2: p.gla_m2, rent_eur_pa: p.rent_eur_pa, walt_years: p.walt_years }
        : undefined;

      // filtre permanent: rent = 0 des deux côtés
      const ra = Number(am?.rent_eur_pa ?? 0);
      const rp = Number(pm?.rent_eur_pa ?? 0);
      if (ra === 0 && rp === 0) continue;

      const label =
        a?.label ??
        p?.label ??
        key.split("::")[1]?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ??
        key;

      const delta_gla = (Number(am?.gla_m2 ?? 0) - Number(pm?.gla_m2 ?? 0));
      const delta_rent = (Number(am?.rent_eur_pa ?? 0) - Number(pm?.rent_eur_pa ?? 0));
      const delta_walt = (Number(am?.walt_years ?? 0) - Number(pm?.walt_years ?? 0));

      const baseG = Number(pm?.gla_m2 ?? 0);
      const baseR = Number(pm?.rent_eur_pa ?? 0);

      let status: Status;
      if (!am && pm) status = "missing_on_am";
      else if (am && !pm) status = "missing_on_pm";
      else {
        const abs = Math.abs;
        const MINOR_PCT = 0.02;
        const MAJOR_PCT = 0.05;
        const MINOR_WALT = 0.1;
        const MAJOR_WALT = 0.5;

        const misG = baseG ? abs(delta_gla) / baseG : 0;
        const misR = baseR ? abs(delta_rent) / baseR : 0;
        const misW = abs(delta_walt);

        const major = misG >= MAJOR_PCT || misR >= MAJOR_PCT || misW >= MAJOR_WALT;
        const minor = !major && (misG >= MINOR_PCT || misR >= MINOR_PCT || misW >= MINOR_WALT);
        status = major ? "major_mismatch" : minor ? "minor_mismatch" : "match";
      }

      lines.push({
        tenantId: key,
        tenantLabel: label,
        am,
        pm,
        delta: { gla: delta_gla, rent: delta_rent, walt: delta_walt },
        status,
      });
    }

    lines.sort((a, b) =>
      (a.tenantLabel ?? a.tenantId).localeCompare(b.tenantLabel ?? b.tenantId)
    );

    const tenants_total = lines.length;
    const tenants_mismatch = lines.filter((l) => l.status !== "match").length;
    const delta_rent_sum = lines.reduce((s, l) => s + (Number(l.delta?.rent) || 0), 0);
    const match_rate = tenants_total ? (tenants_total - tenants_mismatch) / tenants_total : 1;

    return NextResponse.json({
      kpis: { match_rate, tenants_total, tenants_mismatch, delta_rent_sum },
      lines,
      generated_at: new Date().toISOString(),
    });
  } catch (e: unknown) {
    console.error("[/api/rr/[asset]] ERROR:", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
