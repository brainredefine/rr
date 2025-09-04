import { NextResponse } from "next/server";
import { loadCsv, loadBridgeTenants, loadThresholds } from "@/lib/fsdata";
import { makeTenantNormalizer } from "@/lib/bridge";
import { computeDiff, filterDiffLines } from "@/lib/diff";

type Params = { params: { asset: string } };

export async function GET(req: Request, { params }: Params) {
  const { asset } = params;
  const month = "2025-09";

  const amRows = loadCsv("am", month);
  const pmRows = loadCsv("pm", month);

  const bridge = loadBridgeTenants();
  const tenantNormalizer = makeTenantNormalizer(bridge);
  const thresholds = loadThresholds();

  const diff = computeDiff(amRows, pmRows, tenantNormalizer, thresholds);
  const filtered = filterDiffLines(diff.lines, { assetCodes: [asset] });

  return NextResponse.json({ ...diff, lines: filtered });
}
