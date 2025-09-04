// /lib/diff.ts
import { DiffLine, DiffResult, Pair, Row, Thresholds } from "./types";

/**
 * Interface minimale attendue par diff.ts pour le normalizer de tenants.
 * (fournie par makeTenantNormalizer dans /lib/bridge.ts)
 */
export type TenantNormalizer = {
  toCanonicalSlug: (name: string) => string;
  toCanonicalLabel: (name: string) => string;
};

const toId = (asset: string, canonicalSlug: string) => `${asset}::${canonicalSlug}`;

function safeNum(n: unknown, fallback = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : fallback;
}

function pct(absDelta: number, base: number): number {
  const b = safeNum(base, 0);
  if (!b) return 0;
  return Math.abs(absDelta) / b;
}

function classifyStatus(
  dGLA: number,
  glaPct: number,
  dRent: number,
  rentPct: number,
  dWALT: number,
  T: Thresholds
): DiffLine["status"] {
  const within =
    (Math.abs(dGLA) <= T.gla_abs || glaPct <= T.gla_pct) &&
    (Math.abs(dRent) <= T.rent_abs || rentPct <= T.rent_pct) &&
    (Math.abs(dWALT) <= T.walt_year);

  if (within) return "match";

  const major =
    (Math.abs(dGLA) > T.major_multiplier * T.gla_abs && glaPct > T.major_multiplier * T.gla_pct) ||
    (Math.abs(dRent) > T.major_multiplier * T.rent_abs && rentPct > T.major_multiplier * T.rent_pct) ||
    (Math.abs(dWALT) > T.major_multiplier * T.walt_year);

  return major ? "major_mismatch" : "minor_mismatch";
}

/**
 * Calcule le diff AM vs PM au niveau tenant (par asset), en s'appuyant sur :
 * - une clé unique = asset_code :: slugCanoniqueDuTenant
 * - un bridge/normalizer qui transforme n'importe quel libellé en slug canonique
 * - des seuils/tolérances T
 */
export function computeDiff(
  amRows: Row[],
  pmRows: Row[],
  tenantNormalize: TenantNormalizer,
  T: Thresholds
): DiffResult {
  const byId = new Map<string, Pair>();

  // AM
  for (const r of amRows) {
    const asset = (r.asset_code ?? "").trim();
    if (!asset) continue;
    const slug = tenantNormalize.toCanonicalSlug(r.tenant_name ?? "");
    const label = tenantNormalize.toCanonicalLabel(r.tenant_name ?? "");
    const id = toId(asset, slug);
    const prev = byId.get(id);
    byId.set(id, {
      asset,
      tenantId: id,
      tenantLabel: prev?.tenantLabel ?? label, // garde label canonique
      am: r,
      pm: prev?.pm
    });
  }

  // PM
  for (const r of pmRows) {
    const asset = (r.asset_code ?? "").trim();
    if (!asset) continue;
    const slug = tenantNormalize.toCanonicalSlug(r.tenant_name ?? "");
    const label = tenantNormalize.toCanonicalLabel(r.tenant_name ?? "");
    const id = toId(asset, slug);
    const prev = byId.get(id);
    byId.set(id, {
      asset,
      tenantId: id,
      tenantLabel: prev?.tenantLabel ?? label,
      am: prev?.am,
      pm: r
    });
  }

  const lines: DiffLine[] = [];
  let tenantsTotal = 0;
  let tenantsMismatch = 0;
  let deltaRentSum = 0;

  for (const p of byId.values()) {
    const am = p.am;
    const pm = p.pm;

    // Cas manquants d'un côté
    if (!am || !pm) {
    tenantsTotal++;
    const status = am ? "missing_on_pm" as DiffLine["status"] 
                        : "missing_on_am" as DiffLine["status"];
    tenantsMismatch++; // forcément un mismatch si c’est manquant
    lines.push({ ...p, status });
    continue;
    }

    // Valeurs sécurisées
    const amGLA = safeNum(am.gla_m2, 0);
    const pmGLA = safeNum(pm.gla_m2, 0);
    const amRent = safeNum(am.rent_eur_pa, 0);
    const pmRent = safeNum(pm.rent_eur_pa, 0);
    const amWALT = safeNum(am.walt_years, 0);
    const pmWALT = safeNum(pm.walt_years, 0);

    // Deltas
    const dGLA = amGLA - pmGLA;
    const dRent = amRent - pmRent;
    const dWALT = amWALT - pmWALT;

    // Pourcentages (sur base AM)
    const glaPct = pct(dGLA, amGLA);
    const rentPct = pct(dRent, amRent);

    // Statut
    const status = classifyStatus(dGLA, glaPct, dRent, rentPct, dWALT, T);

    tenantsTotal++;
    if (status !== "match") tenantsMismatch++;
    deltaRentSum += dRent;

    lines.push({
      ...p,
      am,
      pm,
      delta: {
        gla: dGLA,
        gla_pct: glaPct,
        rent: dRent,
        rent_pct: rentPct,
        walt: dWALT
      },
      status
    });
  }

  // Tri stable : par asset puis tenantId
  lines.sort(
    (a, b) => a.asset.localeCompare(b.asset) || a.tenantId.localeCompare(b.tenantId)
  );

  const matchRate = tenantsTotal ? (tenantsTotal - tenantsMismatch) / tenantsTotal : 1;

  return {
    generated_at: new Date().toISOString(),
    thresholds: T,
    lines,
    kpis: {
      match_rate: matchRate,
      tenants_total: tenantsTotal,
      tenants_mismatch: tenantsMismatch,
      delta_rent_sum: deltaRentSum
    }
  };
}

/**
 * Optionnel : utilitaire pour filtrer/slicer en mémoire (utile côté UI si tu veux paginer sans DB).
 */
export function filterDiffLines(
  lines: DiffLine[],
  opts: {
    assetCodes?: string[];
    statuses?: DiffLine["status"][];
    maxAbsRentDelta?: number;
    maxAbsGlaDelta?: number;
  } = {}
): DiffLine[] {
  const assets = opts.assetCodes ? new Set(opts.assetCodes) : null;
  const statuses = opts.statuses ? new Set(opts.statuses) : null;

  return lines.filter((l) => {
    if (assets && !assets.has(l.asset)) return false;
    if (statuses && !statuses.has(l.status)) return false;

    if (opts.maxAbsRentDelta != null && l.delta) {
      if (Math.abs(l.delta.rent) > opts.maxAbsRentDelta) return false;
    }
    if (opts.maxAbsGlaDelta != null && l.delta) {
      if (Math.abs(l.delta.gla) > opts.maxAbsGlaDelta) return false;
    }
    return true;
  });
}

/**
 * Optionnel : export CSV minimal (Overview).
 * (Tu peux l'appeler pour télécharger un CSV depuis l'UI.)
 */
export function diffLinesToCSV(lines: DiffLine[]): string {
  const header = [
    "asset",
    "tenant_id",
    "am_gla_m2",
    "pm_gla_m2",
    "delta_gla",
    "delta_gla_pct",
    "am_rent_eur_pa",
    "pm_rent_eur_pa",
    "delta_rent",
    "delta_rent_pct",
    "am_walt_years",
    "pm_walt_years",
    "delta_walt",
    "status"
  ];

  const rows = lines.map((l) => {
    const am = l.am ?? ({} as Row);
    const pm = l.pm ?? ({} as Row);
    const d = l.delta ?? { gla: 0, gla_pct: 0, rent: 0, rent_pct: 0, walt: 0 };

    return [
      l.asset,
      l.tenantId,
      safeNum(am.gla_m2, 0).toString(),
      safeNum(pm.gla_m2, 0).toString(),
      safeNum(d.gla, 0).toString(),
      safeNum(d.gla_pct, 0).toString(),
      safeNum(am.rent_eur_pa, 0).toString(),
      safeNum(pm.rent_eur_pa, 0).toString(),
      safeNum(d.rent, 0).toString(),
      safeNum(d.rent_pct, 0).toString(),
      safeNum(am.walt_years, 0).toString(),
      safeNum(pm.walt_years, 0).toString(),
      safeNum(d.walt, 0).toString(),
      l.status
    ].join(",");
  });

  return [header.join(","), ...rows].join("\n");
}
