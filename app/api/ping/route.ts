export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

type FileStatus =
  | { file: string; ok: true }
  | { file: string; ok: false; error: string };

export async function GET() {
  try {
    const root = process.cwd();
    const must = [
      "config/thresholds.json",
      "data/bridge/tenants.json",
      "data/am/2025-09.csv",
      "data/pm/2025-09.csv",
    ];

    const status: FileStatus[] = must.map((p) => {
      const full = path.join(root, p);
      try {
        fs.accessSync(full, fs.constants.R_OK);
        return { file: p, ok: true };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return { file: p, ok: false, error: msg };
      }
    });

    return NextResponse.json({ ok: status.every((s) => s.ok), status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
