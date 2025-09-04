"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const r = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user, pass })
    });
    if (res.ok) r.push("/rr/overview");
    else setErr("Login invalide");
  }

  return (
    <div className="min-h-dvh grid place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-xs space-y-3 rounded-xl border border-gray-300 bg-white p-4 text-gray-900 shadow">
        <h1 className="text-lg font-semibold">Connexion</h1>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <input className="w-full rounded border px-3 py-2" placeholder="Utilisateur" value={user} onChange={e=>setUser(e.target.value)} />
        <input className="w-full rounded border px-3 py-2" placeholder="Mot de passe" type="password" value={pass} onChange={e=>setPass(e.target.value)} />
        <button className="w-full rounded bg-black py-2 text-white">Se connecter</button>
      </form>
    </div>
  );
}
