export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pas de cache pour tes CSV/XLSX

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession } from "@/lib/session";
import { loadUsers } from "@/lib/fsdata";

export async function POST(req: Request) {
  try {
    const { user, pass } = await req.json();
    const list = loadUsers().users;
    const found = list.find(u => u.user === user && u.pass === pass);
    if (!found) {
      return NextResponse.json({ ok: false, error: "Invalid creds" }, { status: 401 });
    }
    const token = await createSession({ u: found.user, am: found.am as any });

    const cookieStore = await cookies();              // ✅ await
    cookieStore.set("session", token, {               // ✅ set sur l’instance
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 3600,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? "error" }, { status: 500 });
  }
}
