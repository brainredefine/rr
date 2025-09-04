import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";
import OverviewClient from "./OverviewClient";

export default async function Page() {
  const cookieStore = await cookies(); // ← await
  const token = cookieStore.get("session")?.value ?? null;
  const sess = await readSession(token);
  if (!sess) redirect("/login");
  return <OverviewClient />;
}
