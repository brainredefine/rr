import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret-please-change");

export type Session = { u: string; am: "CFR"|"FKE"|"BKO"|"MSC"|"ADMIN"; exp?: number };

export async function createSession(s: Session) {
  return await new SignJWT({ u: s.u, am: s.am })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(secret);
}

export async function readSession(token?: string | null): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return { u: String(payload.u), am: payload.am as Session["am"] };
  } catch {
    return null;
  }
}
