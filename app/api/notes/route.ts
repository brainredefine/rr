// app/api/notes/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBridgeAssets } from "@/lib/fsdata";

type NotesRow = { tenant_id: string; comment: string | null; updated_by: string };

function isSuper(sess: { am?: string; u?: string } | null) {
  return !!sess && (sess.am === "ADMIN" || sess.am === "MGA" || sess.u === "MGA");
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sess = await readSession(cookieStore.get("session")?.value ?? null);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const supa = supabaseAdmin();

    // We still fetch only the current AM's notes (safe default).
    const { data, error } = await supa
      .from("comments_personal")
      .select("tenant_id, comment, updated_by")
      .eq("updated_by", sess.am);

    if (error) throw new Error(error.message);

    const items = Object.fromEntries(((data as NotesRow[]) ?? []).map(r => [r.tenant_id, r.comment ?? ""]));
    return NextResponse.json({ version: 1, items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/notes] GET", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sess = await readSession(cookieStore.get("session")?.value ?? null);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = (await req.json()) as { key?: string; comment?: string };
    const { key, comment } = body;
    if (typeof key !== "string" || typeof comment !== "string") {
      return NextResponse.json({ ok: false, error: "invalid body" }, { status: 400 });
    }

    // Owner check (SUPER bypass)
    const asset = key.split("::")[0] ?? "";
    const owners = loadBridgeAssets() as Record<string, string>;
    if (!isSuper(sess) && owners[asset] !== sess.am) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const supa = supabaseAdmin();
    const { error } = await supa
      .from("comments_personal")
      .upsert(
        { tenant_id: key, comment, updated_by: sess.am },
        // ✅ matches a unique constraint on `tenant_id` only
        { onConflict: "tenant_id" }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/notes] PUT", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
