// lib/csv.ts
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import * as iconv from "iconv-lite"; // ⬅️ nouveau
import type { Row } from "./types";

function toNum(v: any): number {
  if (v == null) return 0;
  const s = String(v).trim().replace(/\u00A0/g, " "); // no-break space
  // remplace virgule décimale par point
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeaders(rec: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(rec)) {
    const nk = k
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "_");
    out[nk] = rec[k];
  }
  return out;
}

function decodeToUtf8(buf: Buffer): string {
  // 1) Essaye UTF-8
  let s = buf.toString("utf8");
  // Si le décodage a produit des caractères de remplacement, essaie Win-1252
  if (s.includes("\uFFFD")) {
    try {
      s = iconv.decode(buf, "win1252");
    } catch {
      // ignore, on gardera la version UTF-8 si ça plante
    }
  }
  // Normalise Unicode (évite les équivalents combinés vs précomposés)
  return s.normalize("NFC");
 }


export function parseCsvString(input: string): Row[] {
  const recs = parse(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: [",", ";", "\t"],
    relax_column_count: true,
  }) as Record<string, any>[];

  const out: Row[] = [];
  for (const r0 of recs) {
    const r = normalizeHeaders(r0);
    const asset_code = String(r.asset_code ?? "").trim();
    const tenant_name = String(r.tenant_name ?? "").trim();
    if (!asset_code || !tenant_name) continue;
    out.push({
      asset_code,
      tenant_name,
      gla_m2: toNum(r.gla_m2),
      rent_eur_pa: toNum(r.rent_eur_pa),
      walt_years: toNum(r.walt_years),
    });
  }
  return out;
}

export function parseXlsxBuffer(buf: Buffer): Row[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const recs = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false }) as Record<string, any>[];

  const out: Row[] = [];
  for (const r0 of recs) {
    const r = normalizeHeaders(r0);
    const asset_code = String(r.asset_code ?? "").trim();
    const tenant_name = String(r.tenant_name ?? "").trim();
    if (!asset_code || !tenant_name) continue;
    out.push({
      asset_code,
      tenant_name,
      gla_m2: toNum(r.gla_m2),
      rent_eur_pa: toNum(r.rent_eur_pa),
      walt_years: toNum(r.walt_years),
      lease_start: String(r.lease_start ?? "").trim(),
      lease_end: String(r.lease_end ?? "").trim(),
      options_text: String(r.options ?? r.options_text ?? "").trim(),
      psm: toNum(r.psm),
    });
  }
  return out;
}

/** Détecte automatiquement CSV vs XLSX selon l’extension et/ou l’en-tête binaire. */
export function parseTabularFile(input: Buffer | string, filename: string): Row[] {
  const lower = filename.toLowerCase();
  const isXlsxExt = lower.endsWith(".xlsx");
  const isCsvExt = lower.endsWith(".csv");

  if (typeof input !== "string") {
    const isZipHeader = input.length >= 4 && input[0] === 0x50 && input[1] === 0x4b; // "PK"
    if (isXlsxExt || isZipHeader) return parseXlsxBuffer(input);
    // ⬇️ CSV binaire: décode intelligemment vers UTF-8 (UTF-8 sinon fallback Win-1252)
    const text = decodeToUtf8(input);
    return parseCsvString(text);
  } else {
    // ⬇️ CSV déjà texte: normalise Unicode
    const text = input.normalize("NFC");
    return parseCsvString(text);
  }
}

