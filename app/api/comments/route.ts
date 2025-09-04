export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CommentRow = { key: string; comment: string | null; updated_by?: string | null };

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("comments").select("key, comment");
    if (error) throw error;

    const items = Object.fromEntries(((data as CommentRow[]) ?? []).map(r => [r.key, r.comment ?? ""]));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/comments] GET:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json() as { key?: unknown; comment?: unknown; updated_by?: unknown };
    if (typeof body.key !== "string" || typeof body.comment !== "string") {
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    const sb = supabaseAdmin();
    const { error } = await sb
      .from("comments")
      .upsert(
        [{ key: body.key, comment: body.comment, updated_by: typeof body.updated_by === "string" ? body.updated_by : null }],
        { onConflict: "key" }
      );
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/comments] PUT:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
