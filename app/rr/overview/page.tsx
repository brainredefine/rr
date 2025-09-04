import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";
import OverviewClient from "./OverviewClient"; // ton composant client

export default async function Page() {
  const cookieStore = await cookies();          // ✅
  const token = cookieStore.get("session")?.value;
  const sess = await readSession(token);
  if (!sess) redirect("/login");
  return <OverviewClient />; // le client fetchera /api/rr/overview, qui est filtré par la session
}
