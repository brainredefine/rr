export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pas de cache pour tes CSV/XLSX

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadBridgeAssets } from "@/lib/fsdata";

type NotesRow = { tenant_id: string; comment: string | null; updated_by: string };

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sess = await readSession(cookieStore.get("session")?.value ?? null);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const supa = supabaseAdmin();
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

    // sécurité : l'asset doit appartenir à l'AM courant (sauf ADMIN)
    const asset = key.split("::")[0] ?? "";
    const owners = loadBridgeAssets() as Record<string, string>; // aide pour l'indexation TS
    if (sess.am !== "ADMIN" && owners[asset] !== sess.am) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const supa = supabaseAdmin();
    const { error } = await supa
      .from("comments_personal")
      .upsert({ tenant_id: key, comment, updated_by: sess.am }, { onConflict: "tenant_id" });

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[/api/notes] PUT", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
