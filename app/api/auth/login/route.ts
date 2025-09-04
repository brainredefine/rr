export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // pas de cache

import { NextResponse } from "next/server";
import { createSession } from "@/lib/session";
import { loadUsers } from "@/lib/fsdata";

type AMCode = "CFR" | "FKE" | "BKO" | "MSC" | "ADMIN";
type UserRec = { user: string; pass: string; am: AMCode };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { user?: string; pass?: string };
    const { user, pass } = body;
    if (!user || !pass) {
      return NextResponse.json({ ok: false, error: "missing credentials" }, { status: 400 });
    }

    const list = (loadUsers().users ?? []) as UserRec[];
    const found = list.find((u) => u.user === user && u.pass === pass);
    if (!found) {
      return NextResponse.json({ ok: false, error: "Invalid creds" }, { status: 401 });
    }

    // plus de "as any" ici, on tape AM correctement
    const token = await createSession({ u: found.user, am: found.am });

    // IMPORTANT: on set le cookie sur la réponse (et pas via cookies())
    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 3600,
    });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
