import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { redirect } from "next/navigation";
import LeasesClient from "./LeasesClient";

export default async function Page() {
  const cookieStore = await cookies();
  const sess = await readSession(cookieStore.get("session")?.value ?? null);
  if (!sess) redirect("/login");
  return <LeasesClient />;
}
