// lib/csv.ts
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import * as iconv from "iconv-lite";
import type { Row } from "./types";

type AnyRec = Record<string, unknown>;

function toNum(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).trim().replace(/\u00A0/g, " "); // no-break space
  const n = Number(s.replace(",", ".")); // virgule -> point
  return Number.isFinite(n) ? n : 0;
}

function getStr(o: AnyRec, key: string): string {
  return String(o[key] ?? "").trim();
}

function normalizeHeaders(rec: AnyRec): AnyRec {
  const out: AnyRec = {};
  for (const k of Object.keys(rec)) {
    const nk = k.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "_");
    out[nk] = rec[k];
  }
  return out;
}

function decodeToUtf8(buf: Buffer): string {
  // 1) Essaye UTF-8
  let s = buf.toString("utf8");
  // 2) Si caractères de remplacement, tente Windows-1252
  if (s.includes("\uFFFD")) {
    try {
      s = iconv.decode(buf, "win1252"); // alias de "windows-1252"
    } catch {
      // garde la version UTF-8 si ça plante
    }
  }
  // 3) Normalise Unicode
  return s.normalize("NFC");
}

export function parseCsvString(input: string): Row[] {
  const recs = parse<AnyRec>(input, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    delimiter: [",", ";", "\t"],
    relax_column_count: true,
  });

  const out: Row[] = [];
  for (const r0 of recs) {
    const r = normalizeHeaders(r0);
    const asset_code = getStr(r, "asset_code");
    const tenant_name = getStr(r, "tenant_name");
    if (!asset_code || !tenant_name) continue;

    out.push({
      asset_code,
      tenant_name,
      gla_m2: toNum(r["gla_m2"]),
      rent_eur_pa: toNum(r["rent_eur_pa"]),
      walt_years: toNum(r["walt_years"]),
    });
  }
  return out;
}

export function parseXlsxBuffer(buf: Buffer): Row[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const recs = XLSX.utils.sheet_to_json<AnyRec>(ws, { defval: "", raw: false });

  const out: Row[] = [];
  for (const r0 of recs) {
    const r = normalizeHeaders(r0);
    const asset_code = getStr(r, "asset_code");
    const tenant_name = getStr(r, "tenant_name");
    if (!asset_code || !tenant_name) continue;

    out.push({
      asset_code,
      tenant_name,
      gla_m2: toNum(r["gla_m2"]),
      rent_eur_pa: toNum(r["rent_eur_pa"]),
      walt_years: toNum(r["walt_years"]),
      lease_start: getStr(r, "lease_start"),
      lease_end: getStr(r, "lease_end"),
      options_text: getStr(r, "options") || getStr(r, "options_text"),
      psm: toNum(r["psm"]),
    });
  }
  return out;
}

/** Détecte automatiquement CSV vs XLSX selon l’extension et/ou l’en-tête binaire. */
export function parseTabularFile(input: Buffer | string, filename: string): Row[] {
  const lower = filename.toLowerCase();
  const isXlsxExt = lower.endsWith(".xlsx");

  if (typeof input !== "string") {
    const isZipHeader = input.length >= 4 && input[0] === 0x50 && input[1] === 0x4b; // "PK"
    if (isXlsxExt || isZipHeader) return parseXlsxBuffer(input);
    // CSV binaire: décode intelligemment vers UTF-8 (fallback Win-1252)
    const text = decodeToUtf8(input);
    return parseCsvString(text);
  } else {
    // CSV déjà texte: normalise Unicode
    const text = input.normalize("NFC");
    return parseCsvString(text);
  }
}
