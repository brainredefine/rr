// lib/fsdata.ts
import fs from "node:fs";
import path from "node:path";
import { parseTabularFile } from "./csv";
import type { BridgeTenants, BridgeAssets, Row, Thresholds } from "./types";

const root = process.cwd();

export function loadUsers(): { users: { user: string; pass: string; am: string }[] } {
  return JSON.parse(readText("config/users.json"));
}

function readFileBuffer(p: string): Buffer {
  return fs.readFileSync(path.join(root, p));
}
function readText(p: string): string {
  return readFileBuffer(p).toString("utf8");
}

export function loadThresholds(): Thresholds {
  return JSON.parse(readText("config/thresholds.json"));
}

export function loadBridgeTenants(): BridgeTenants {
  return JSON.parse(readText("data/bridge/tenants.json"));
}

export function loadBridgeAssets(): BridgeAssets {
  return JSON.parse(readText("data/bridge/assets.json"));
}

export function loadCsv(kind: "am" | "pm", yyyymm: string): Row[] {
  // On supporte data/{kind}/{yyyymm}.csv ou .xlsx
  const base = `data/${kind}/${yyyymm}`;
  const candidates = [`${base}.csv`, `${base}.xlsx`];

  for (const file of candidates) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) {
      const buf = fs.readFileSync(full);
      return parseTabularFile(buf, file);
    }
  }
  // Si aucun fichier trouvé → erreur claire
  throw new Error(`Aucun fichier trouvé pour ${kind} ${yyyymm} (essayé: ${candidates.join(", ")})`);
}
