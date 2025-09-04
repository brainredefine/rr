export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pas de cache pour tes CSV/XLSX

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Payload = { version: number; items: Record<string, string> };

export async function GET() {
  try {
    const supa = supabaseAdmin();
    const { data, error } = await supa.from("comments").select("tenant_id, comment");
    if (error) throw error;

    const items: Record<string, string> = {};
    for (const row of data ?? []) items[row.tenant_id] = row.comment ?? "";

    const payload: Payload = { version: 1, items };
    return NextResponse.json(payload);
  } catch (e: any) {
    console.error("[/api/comments] GET", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { key, comment, updated_by } = await req.json();
    if (typeof key !== "string" || typeof comment !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const supa = supabaseAdmin();
    const { error } = await supa
      .from("comments")
      .upsert(
        [{ tenant_id: key, comment, updated_by }],
        { onConflict: "tenant_id" }
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[/api/comments] PUT", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
