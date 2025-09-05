// app/api/comments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CommentRow = { tenant_id: string; comment: string | null };

function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in (e as any)) return String((e as any).message);
  try { return JSON.stringify(e); } catch { return String(e); }
}

export async function GET() {
  try {
    const supa = supabaseAdmin();
    const { data, error } = await supa
      .from("comments")
      .select<"tenant_id, comment", CommentRow>("tenant_id, comment");
    if (error) throw error;

    const items = Object.fromEntries((data ?? []).map((r) => [r.tenant_id, r.comment ?? ""]));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = errMsg(e);
    console.error("[/api/comments] GET", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as { key?: string; tenant_id?: string; comment?: string };
    const tenantId = (body.tenant_id ?? body.key ?? "").trim();
    if (!tenantId) return NextResponse.json({ ok: false, error: "missing tenant_id" }, { status: 400 });

    const comment = body.comment ?? "";

    const supa = supabaseAdmin();

    // 1) Existe ?
    const { data: existing, error: selErr } = await supa
      .from("comments")
      .select<"tenant_id", Pick<CommentRow, "tenant_id">>("tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (selErr && selErr.code !== "PGRST116") {
      // PGRST116 = no rows, ce n’est pas une vraie erreur pour maybeSingle()
      throw selErr;
    }

    if (existing) {
      // 2a) Update
      const { error: updErr } = await supa
        .from("comments")
        .update({ comment })
        .eq("tenant_id", tenantId);
      if (updErr) throw updErr;
    } else {
      // 2b) Insert
      const { error: insErr } = await supa
        .from("comments")
        .insert([{ tenant_id: tenantId, comment } as CommentRow]);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = errMsg(e);
    console.error("[/api/comments] PUT", e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
