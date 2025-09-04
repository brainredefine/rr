export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pas de cache pour tes CSV/XLSX

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { loadBridgeAssets } from "@/lib/fsdata";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sess = await readSession(cookieStore.get("session")?.value ?? null);
    if (!sess) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

    const supa = supabaseAdmin();
    // on ne renvoie que les notes de l'AM connecté (séparation stricte)
    const { data, error } = await supa
      .from("comments_personal")
      .select("tenant_id, comment, updated_by")
      .eq("updated_by", sess.am);
    if (error) throw error;

    const items: Record<string, string> = {};
    for (const row of data ?? []) items[row.tenant_id] = row.comment ?? "";
    return NextResponse.json({ version: 1, items });
  } catch (e: any) {
    console.error("[/api/notes] GET", e);
    return NextResponse.json({ ok:false, error:e?.message ?? "error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const sess = await readSession(cookieStore.get("session")?.value ?? null);
    if (!sess) return NextResponse.json({ ok:false, error:"unauthorized" }, { status: 401 });

    const { key, comment } = await req.json();
    if (typeof key !== "string" || typeof comment !== "string") {
      return NextResponse.json({ ok:false, error:"Invalid body" }, { status: 400 });
    }

    // sécurité : l'asset doit appartenir à l'AM courant (sauf ADMIN)
    const asset = key.split("::")[0];
    const owners = loadBridgeAssets();
    if (sess.am !== "ADMIN" && owners[asset] !== sess.am) {
      return NextResponse.json({ ok:false, error:"forbidden" }, { status: 403 });
    }

    const supa = supabaseAdmin();
    const { error } = await supa
      .from("comments_personal")
      .upsert([{ tenant_id: key, comment, updated_by: sess.am }], { onConflict: "tenant_id" });
    if (error) throw error;

    return NextResponse.json({ ok:true });
  } catch (e: any) {
    console.error("[/api/notes] PUT", e);
    return NextResponse.json({ ok:false, error:e?.message ?? "error" }, { status: 500 });
  }
}
