export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export async function GET() {
  try {
    const token = (await cookies()).get("session")?.value ?? null;
    const sess = await readSession(token);

    // Return 200 in all cases so client code can just check ok/user
    if (!sess) {
      return NextResponse.json({ ok: false, user: null, am: null });
    }
    return NextResponse.json({ ok: true, user: sess.u, am: sess.am });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // keep 200 to avoid throwing in the header
    return NextResponse.json({ ok: false, error: msg, user: null, am: null });
  }
}
