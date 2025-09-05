"use client";

import React, { useEffect, useState } from "react";

type DiffLine = {
  asset: string;
  tenantId: string;
  tenantLabel?: string;
  am?: { gla_m2: number; rent_eur_pa: number; walt_years: number };
  pm?: { gla_m2: number; rent_eur_pa: number; walt_years: number };
  delta?: { gla: number; rent: number; walt: number; gla_pct: number; rent_pct: number };
  status: string;
};
type DiffResult = {
  kpis?: { match_rate: number; tenants_total: number; tenants_mismatch: number; delta_rent_sum: number };
  lines: DiffLine[];
};

const fmtInt = (v: number | undefined | null) =>
  v == null || Number.isNaN(Number(v))
    ? "-"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v));

const fmt1 = (v: number | undefined | null) =>
  v == null || Number.isNaN(Number(v))
    ? "-"
    : new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(v));

const isMismatch = (s: string) =>
  s === "minor_mismatch" || s === "major_mismatch" || s === "missing_on_am" || s === "missing_on_pm";

function prettyFromTenantId(tenantId: string) {
  const [, slugMaybe] = tenantId.split("::");
  const slug = slugMaybe ?? tenantId;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const norm = (s: string | undefined | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// util: message d’erreur sans any
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function OverviewClient() {
  const [data, setData] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // filtres
  const [onlyMismatch, setOnlyMismatch] = useState(false);
  const [query, setQuery] = useState("");

  // commentaires
  const [comments, setComments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

useEffect(() => {
  (async () => {
    try {
      // 1) données diff obligatoires
      const resDiff = await fetch("/api/rr/overview");
      if (!resDiff.ok) throw new Error(`/api/rr/overview ${resDiff.status}`);
      const diff = (await resDiff.json()) as DiffResult;
      setData(diff);
    } catch (e) {
      console.error("init /api/rr/overview error:", e);
      setError(e instanceof Error ? e.message : String(e));
      return; // stop ici si le core échoue
    }

    // 2) commentaires : best-effort
    try {
      const resComments = await fetch("/api/comments");
      if (!resComments.ok) {
        console.warn("/api/comments failed:", resComments.status);
        setComments({}); // ne bloque pas l’UI
      } else {
        const comm = await resComments.json();
        setComments(comm?.items ?? {});
      }
    } catch (e) {
      console.warn("/api/comments fetch error:", e);
      setComments({});
    }
  })();
}, []);


  async function saveComment(key: string, comment: string) {
    try {
      setSaving((s) => ({ ...s, [key]: true }));
      const res = await fetch("/api/comments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, comment }),
      });
      if (!res.ok) console.error("saveComment failed", res.status, await res.text());
    } catch (e: unknown) {
      console.error("saveComment error", errMsg(e));
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  if (error) return <p className="p-4 text-red-400 md:text-red-500">Erreur: {error}</p>;
  if (!data) return <p className="p-4">Chargement…</p>;

  const k = data.kpis;
  const qn = norm(query);

  // helper: rent = 0 des deux côtés (filtre permanent)
  const bothRentZero = (l: DiffLine) => {
    const ra = Number(l.am?.rent_eur_pa ?? 0);
    const rp = Number(l.pm?.rent_eur_pa ?? 0);
    return ra === 0 && rp === 0;
  };

  // lignes filtrées (permanent: on exclut toujours bothRentZero)
  const lines = (data.lines ?? [])
    .filter((l) => !bothRentZero(l))
    .filter((l) => !onlyMismatch || isMismatch(l.status))
    .filter((l) => {
      if (!qn) return true;
      const assetMatch = norm(l.asset).includes(qn);
      const label = l.tenantLabel ?? prettyFromTenantId(l.tenantId);
      const tenantMatch = norm(label).includes(qn);
      return assetMatch || tenantMatch;
    });

  // KPI filtré
  const deltaRentFiltered = lines.reduce((s, l) => s + (Number(l.delta?.rent) || 0), 0);

  // séparateurs verticaux
  const V = "border-l border-black";

  return (
    <div className="p-6">
      <div className="mb-3 grid gap-3 md:grid-cols-3 md:items-center">
        {/* gauche : titre */}
        <h1 className="text-xl font-bold">RR Abgleich – Vue d’ensemble</h1>

        {/* centre : recherche + toggle, côte à côte et centrés */}
        <div className="flex justify-center">
          <div className="flex items-center gap-3 flex-nowrap">
            <div className="relative shrink-0">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher (asset ou tenant)…"
                className="w-[240px] sm:w-[300px] md:w-[360px] rounded-md border border-gray-300 bg-white/90 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-300"
              />
              {query && (
                <button
                  aria-label="Effacer"
                  onClick={() => setQuery("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              )}
            </div>

            <label className="inline-flex items-center gap-2 whitespace-nowrap shrink-0">
              <input
                type="checkbox"
                className="h-4 w-4 accent-red-500"
                checked={onlyMismatch}
                onChange={(e) => setOnlyMismatch(e.target.checked)}
              />
              <span>Seulement mismatches</span>
            </label>
          </div>
        </div>

        {/* droite : spacer pour équilibrer */}
        <div className="hidden md:block" />
      </div>

      {k ? (
        <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
          {/* KPIs à gauche */}
          <div>Match rate: {(k.match_rate * 100).toFixed(1)}%</div>
          <div>ΔRent (filtres): {fmtInt(deltaRentFiltered)} €</div>
          <div>Résultats: {fmtInt(lines.length)}</div>

          {/* Légende à droite */}
          <div className="ml-auto flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-red-400 ring-1 ring-red-400" />
              <span>Mismatch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-blue-400 ring-1 ring-blue-400" />
              <span>Manquant PM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-orange-400 ring-1 ring-orange-400" />
              <span>Manquant AM</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
          <div className="text-gray-400">KPIs indisponibles.</div>

          {/* Légende à droite même si KPIs absents */}
          <div className="ml-auto flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-red-400 ring-1 ring-red-400" />
              <span>Mismatch</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-blue-400 ring-1 ring-blue-400" />
              <span>Manquant PM</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 rounded-sm bg-orange-400 ring-1 ring-orange-400" />
              <span>Manquant AM</span>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white text-gray-900 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="border-b p-2 text-left whitespace-nowrap" style={{ width: "1%" }}>
                Asset
              </th>
              <th className="border-b p-2 text-left whitespace-nowrap" style={{ width: "1%" }}>
                Tenant
              </th>
              <th className={`border-b p-2 text-center ${V}`}>GLA (AM)</th>
              <th className="border-b p-2 text-center">GLA (PM)</th>
              <th className="border-b p-2 text-center">ΔGLA</th>
              <th className={`border-b p-2 text-center ${V}`}>Rent (AM)</th>
              <th className="border-b p-2 text-center">Rent (PM)</th>
              <th className="border-b p-2 text-center">ΔRent</th>
              <th className={`border-b p-2 text-center ${V}`}>WALT (AM)</th>
              <th className="border-b p-2 text-center">WALT (PM)</th>
              <th className="border-b p-2 text-center">ΔWALT</th>
              <th className="border-b p-2 text-left w-[280px]">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const key = l.tenantId;               // ← identifiant stable
              const val = comments[key] ?? "";
              const savingThis = !!saving[key];

              return (
                <tr key={key} className={`${statusColor(l.status)} text-gray-900`}>
                  <td className="p-2 whitespace-nowrap" style={{ width: "1%" }}>
                    {l.asset}
                  </td>
                  <td className="p-2 whitespace-nowrap" style={{ width: "1%" }}>
                    {l.tenantLabel ?? prettyFromTenantId(l.tenantId)}
                  </td>

                  {/* GLA */}
                  <td className={`p-2 text-center ${V}`}>{fmtInt(l.am?.gla_m2)}</td>
                  <td className="p-2 text-center">{fmtInt(l.pm?.gla_m2)}</td>
                  <td className="p-2 text-center">{fmtInt(l.delta?.gla)}</td>

                  {/* Rent */}
                  <td className={`p-2 text-center ${V}`}>{fmtInt(l.am?.rent_eur_pa)}</td>
                  <td className="p-2 text-center">{fmtInt(l.pm?.rent_eur_pa)}</td>
                  <td className="p-2 text-center">{fmtInt(l.delta?.rent)}</td>

                  {/* WALT */}
                  <td className={`p-2 text-center ${V}`}>{fmt1(l.am?.walt_years)}</td>
                  <td className="p-2 text-center">{fmt1(l.pm?.walt_years)}</td>
                  <td className="p-2 text-center">{fmt1(l.delta?.walt)}</td>

                  {/* Commentaire */}
                  <td className="p-2">
                    <input
                      className={`w-full rounded border px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 ${savingThis ? "opacity-60" : ""}`}
                      placeholder="Ajouter un commentaire…"
                      value={val}
                      onChange={(e) => setComments((m) => ({ ...m, [key]: e.target.value }))}
                      onBlur={() => saveComment(key, comments[key] ?? "")}  // ← envoie bien tenantId
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "match":
      return "bg-green-200";
    case "minor_mismatch":
      return "bg-red-200";
    case "major_mismatch":
      return "bg-red-200";
    case "missing_on_am":
      return "bg-orange-200";
    case "missing_on_pm":
      return "bg-blue-200";
    default:
      return "";
  }
}
