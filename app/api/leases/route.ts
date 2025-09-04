import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { resolveDataFile } from "@/lib/paths";
import { parseTabularFile } from "@/lib/csv"; // ta fonction autodétect CSV/XLSX

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // évite le cache Vercel

export async function GET() {
  try {
    const filePath = resolveDataFile("am.xlsx"); // ou "am.csv"
    const buf = await readFile(filePath);
    const rows = parseTabularFile(buf, filePath); // ← gère CSV & XLSX

    // ...ton mapping vers { kpis, lines } ici...
    const lines = rows.map(r => ({
      asset: r.asset_code,
      tenantId: `${r.asset_code}::${(r.tenant_name ?? "").toLowerCase().replace(/\s+/g,"_")}`,
      tenantLabel: r.tenant_name,
      gla_m2: r.gla_m2,
      rent_eur_pa: r.rent_eur_pa,
      walt_years: r.walt_years,
      lease_start: r.lease_start,
      lease_end: r.lease_end,
      options_text: r.options_text,
      psm: r.psm,
    }));

    const kpis = {
      tenants_total: lines.length,
      rent_sum: lines.reduce((s,l)=> s + (Number(l.rent_eur_pa)||0), 0),
    };

    return NextResponse.json({ kpis, lines });
  } catch (e:any) {
    console.error("[/api/leases] error:", e);
    return NextResponse.json({ error: e?.message ?? "Server error" }, { status: 500 });
  }
}
