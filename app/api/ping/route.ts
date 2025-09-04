export const runtime = "nodejs";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const root = process.cwd();
    const must = [
      "config/thresholds.json",
      "data/bridge/tenants.json",
      "data/am/2025-09.csv",
      "data/pm/2025-09.csv"
    ];
    const status = must.map(p => {
      const full = path.join(root, p);
      try {
        fs.accessSync(full, fs.constants.R_OK);
        return { file: p, ok: true };
      } catch (e: any) {
        return { file: p, ok: false, error: e?.message ?? String(e) };
      }
    });
    return NextResponse.json({ ok: status.every(s => s.ok), status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
