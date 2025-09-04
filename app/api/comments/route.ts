export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sbServer } from "@/lib/supabase-server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const sb = sbServer();
    const { data, error } = await sb.from("comments").select("key, comment");
    if (error) throw new Error(error.message);

    const items = Object.fromEntries(
      (data ?? []).map((r: { key: string; comment: string | null }) => [r.key, r.comment ?? ""])
    );

    return NextResponse.json({ items });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session")?.value ?? null;
    const sess = await readSession(token);
    if (!sess) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { key, comment } = (await req.json()) as { key: string; comment: string };
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    const sb = sbServer();
    const { error } = await sb.from("comments").upsert({ key, comment });
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
