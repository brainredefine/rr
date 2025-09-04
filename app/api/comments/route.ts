export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type DbComment = { key: string; comment: string | null };

export async function GET() {
  try {
    const sb = supabaseAdmin();
    const { data, error } = await sb.from("comments").select("key, comment");
    if (error) throw error;

    const items = Object.fromEntries(
      ((data as DbComment[]) ?? []).map((r) => [r.key, r.comment ?? ""])
    );
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/comments] GET", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { key?: string; comment?: string };
    const key = body?.key ?? "";
    const comment = body?.comment ?? "";
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    const sb = supabaseAdmin();
    const { error } = await sb
      .from("comments")
      .upsert({ key, comment }, { onConflict: "key" });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/comments] PUT", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
