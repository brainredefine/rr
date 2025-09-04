import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadCsv, loadBridgeTenants, loadBridgeAssets } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import type { Row } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Side = { gla_m2: number; rent_eur_pa: number; walt_years: number };
type Status = "match" | "minor_mismatch" | "major_mismatch" | "missing_on_am" | "missing_on_pm";

type DiffLine = {
  tenantId: string;
  tenantLabel?: string;
  am?: Side;
  pm?: Side;
  delta?: { gla: number; rent: number; walt: number };
  status: Status;
};

type DiffResult = {
  kpis: { delta_rent_sum: number; tenants_total: number; tenants_mismatch: number };
  lines: DiffLine[];
};

type RouteContext = { params: Promise<{ asset: string }> };

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { asset } = await context.params;

    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const owners = loadBridgeAssets();
    if (sess.am !== "ADMIN" && owners[asset] !== sess.am) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const month = process.env.DATA_MONTH ?? "2025-09";
    const tn = makeTenantNormalizer(loadBridgeTenants());

    const amAll = loadCsv("am", month).filter((r) => (r.asset_code ?? "").trim() === asset);
    const pmAll = loadCsv("pm", month).filter((r) => (r.asset_code ?? "").trim() === asset);

    type AggVal = { label: string; gla_m2: number; rent_eur_pa: number; walt_years: number };

    const aggregate = (rows: Row[]) => {
      const m = new Map<string, AggVal>();
      for (const r of rows) {
        const slug = tn.toCanonicalSlug(r.tenant_name ?? "");
        const label = tn.toCanonicalLabel(r.tenant_name ?? "");
        const key = `${asset}::${slug}`;
        const prev = m.get(key);
        const add = (a?: number, b?: number) => (Number(a) || 0) + (Number(b) || 0);
        if (prev) {
          prev.gla_m2 = add(prev.gla_m2, r.gla_m2);
          prev.rent_eur_pa = add(prev.rent_eur_pa, r.rent_eur_pa);
          prev.walt_years = add(prev.walt_years, r.walt_years);
        } else {
          m.set(key, {
            label,
            gla_m2: Number(r.gla_m2) || 0,
            rent_eur_pa: Number(r.rent_eur_pa) || 0,
            walt_years: Number(r.walt_years) || 0,
          });
        }
      }
      return m;
    };

    const amMap = aggregate(amAll);
    const pmMap = aggregate(pmAll);

    const keys = new Set<string>([...amMap.keys(), ...pmMap.keys()]);
    const lines: DiffLine[] = [];

    for (const key of keys) {
      const a = amMap.get(key);
      const p = pmMap.get(key);

      const am: Side | undefined = a && {
        gla_m2: a.gla_m2,
        rent_eur_pa: a.rent_eur_pa,
        walt_years: a.walt_years,
      };
      const pm: Side | undefined = p && {
        gla_m2: p.gla_m2,
        rent_eur_pa: p.rent_eur_pa,
        walt_years: p.walt_years,
      };

      // Exclure si rent = 0 des deux côtés
      const ra = Number(am?.rent_eur_pa ?? 0);
      const rp = Number(pm?.rent_eur_pa ?? 0);
      if (ra === 0 && rp === 0) continue;

      const delta = {
        gla: (Number(am?.gla_m2 ?? 0) - Number(pm?.gla_m2 ?? 0)),
        rent: (Number(am?.rent_eur_pa ?? 0) - Number(pm?.rent_eur_pa ?? 0)),
        walt: (Number(am?.walt_years ?? 0) - Number(pm?.walt_years ?? 0)),
      };

      let status: Status;
      if (!am && pm) status = "missing_on_am";
      else if (am && !pm) status = "missing_on_pm";
      else {
        const baseG = Number(pm?.gla_m2 ?? 0);
        const baseR = Number(pm?.rent_eur_pa ?? 0);
        const misG = baseG ? Math.abs(delta.gla) / baseG : 0;
        const misR = baseR ? Math.abs(delta.rent) / baseR : 0;
        const misW = Math.abs(delta.walt);
        const major = misG >= 0.05 || misR >= 0.05 || misW >= 0.5;
        const minor = !major && (misG >= 0.02 || misR >= 0.02 || misW >= 0.1);
        status = major ? "major_mismatch" : minor ? "minor_mismatch" : "match";
      }

      lines.push({
        tenantId: key,
        tenantLabel: a?.label ?? p?.label ?? undefined,
        am,
        pm,
        delta,
        status,
      });
    }

    lines.sort((x, y) => (x.tenantLabel ?? x.tenantId).localeCompare(y.tenantLabel ?? y.tenantId));

    const tenants_total = lines.length;
    const tenants_mismatch = lines.filter((l) => l.status !== "match").length;
    const delta_rent_sum = lines.reduce((s, l) => s + (Number(l.delta?.rent) || 0), 0);

    const result: DiffResult = { kpis: { delta_rent_sum, tenants_total, tenants_mismatch }, lines };
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
