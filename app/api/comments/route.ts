// app/api/comments/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type CommentRow = { key: string; comment: string | null };

export async function GET() {
  const supa = supabaseAdmin();
  const { data, error } = await supa.from("comments").select("key, comment");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = Object.fromEntries((data ?? []).map((r: CommentRow) => [r.key, r.comment ?? ""]));
  return NextResponse.json({ items });
}

export async function PUT(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const { key, comment } = body as { key?: string; comment?: string };
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  const supa = supabaseAdmin();
  const { error } = await supa
    .from("comments")
    .upsert({ key, comment: comment ?? "" }, { onConflict: "key" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
