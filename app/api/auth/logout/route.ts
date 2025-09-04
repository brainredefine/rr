import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();          // ✅ await
  cookieStore.set("session", "", { path: "/", maxAge: 0 });
  return NextResponse.json({ ok: true });
}
