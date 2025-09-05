// app/leases/LeasesClient.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";

type Line = {
  asset: string;
  tenantId: string;
  tenantLabel?: string;
  gla_m2?: number;
  rent_eur_pa?: number;
  walt_years?: number;
  lease_start?: string;
  lease_end?: string;
  options_text?: string;
  psm?: number;
};
type Result = {
  kpis?: { tenants_total: number; rent_sum: number };
  lines: Line[];
};

const fmtInt = (v: number | undefined | null) =>
  v == null || Number.isNaN(Number(v)) ? "-" :
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Number(v));
const fmt1 = (v: number | undefined | null) =>
  v == null || Number.isNaN(Number(v)) ? "-" :
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Number(v));
const fmt2 = (v: number | undefined | null) =>
  v == null || Number.isNaN(Number(v)) ? "-" :
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v));

const fmtDateEU = (s?: string | null) => {
  if (!s) return "-";
  const t = String(s).trim();
  if (!t) return "-";
  const parts = t.replace(/[-.\s]+/g, "/").split("/");
  const nums = parts.map((p) => parseInt(p, 10)).filter((n) => Number.isFinite(n));
  if (nums.length !== 3) return "-";
  const [a, b, c] = nums;
  let d = 1, m = 1, y = 2000;
  if (String(parts[0]).length === 4) { y = a; m = b; d = c; }
  else if (String(parts[2]).length === 4) { y = c; d = a > 12 || b <= 12 ? a : b; m = a > 12 || b <= 12 ? b : a; }
  else { y = c + (c < 100 ? (c >= 70 ? 1900 : 2000) : 0); d = a > 12 || b <= 12 ? a : b; m = a > 12 || b <= 12 ? b : a; }
  const dd = String(Math.max(1, Math.min(31, d))).padStart(2, "0");
  const mm = String(Math.max(1, Math.min(12, m))).padStart(2, "0");
  const yyyy = String(y).padStart(4, "0");
  return `${dd}/${mm}/${yyyy}`;
};

const norm = (s: string | undefined | null) =>
  (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function prettyFromTenantId(tenantId: string) {
  const [, slugMaybe] = tenantId.split("::");
  const slug = slugMaybe ?? tenantId;
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LeasesClient() {
  // state
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // fetch
  useEffect(() => {
    (async () => {
      try {
        const [resLease, resNotes] = await Promise.all([
          fetch("/api/leases"),
          fetch("/api/notes"),
        ]);

        if (!resLease.ok) throw new Error(`/api/leases ${resLease.status}`);
        const leases: Result = await resLease.json();

        let personal: Record<string, string> = {};
        try {
          if (resNotes.ok) {
            const n = await resNotes.json();
            personal = n?.items ?? {};
          } else {
            console.warn("/api/notes failed:", resNotes.status);
          }
        } catch (e) {
          console.warn("/api/notes error:", e);
        }

        setData(leases);
        setNotes(personal);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  // save note
  const saveNote = async (key: string, comment: string) => {
    try {
      setSaving((s) => ({ ...s, [key]: true }));
      const res = await fetch("/api/notes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, comment }),
      });
      if (!res.ok) console.error("saveNote failed", res.status, await res.text());
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  };

  // derived
  const qn = norm(query.trim());

  // clé de commentaire par (tenantId + GLA)
  const noteKeyOf = (l: Line) => `${l.tenantId}::gla=${Number(l.gla_m2 ?? 0)}`;

  const linesFiltered = useMemo(() => {
    const base = data?.lines ?? [];
    if (!qn) return base;
    return base.filter((l) => {
      const assetMatch  = norm(l.asset).includes(qn);
      const label       = l.tenantLabel ?? prettyFromTenantId(l.tenantId);
      const tenantMatch = norm(label).includes(qn);
      const noteKey     = noteKeyOf(l);
      const noteVal     = notes[noteKey] ?? notes[l.tenantId] ?? ""; // fallback tenant-only
      const noteMatch   = norm(noteVal).includes(qn);
      return assetMatch || tenantMatch || noteMatch;
    });
  }, [data?.lines, notes, qn]);

  const rentFiltered = useMemo(
    () => linesFiltered.reduce((s, l) => s + (Number(l.rent_eur_pa) || 0), 0),
    [linesFiltered]
  );

  // early returns
  if (error) return <p className="p-4 text-red-500">Erreur: {error}</p>;
  if (!data) return <p className="p-4">Chargement…</p>;

  // UI
  const num = "text-center";
  const V = "border-l border-black";

  return (
    <div className="p-6">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-xl font-bold">Vue normale (AM)</h1>
        <div className="relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (asset, tenant, note)…"
            className="w-64 rounded-md border border-gray-300 bg-white/90 px-3 py-1.5 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-300"
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
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-6 text-sm">
        <div>Résultats: {fmtInt(linesFiltered.length)}</div>
        <div>Rent (filtres): {fmtInt(rentFiltered)} €</div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="border-b p-2 text-left whitespace-nowrap" style={{ width: "1%" }}>Asset</th>
              <th className="border-b p-2 text-left whitespace-nowrap" style={{ width: "5%" }}>Tenant</th>
              <th className={`border-b p-2 ${num} ${V}`}>GLA</th>
              <th className={`border-b p-2 ${num}`}>Rent</th>
              <th className={`border-b p-2 ${num}`}>WALT</th>
              <th className="border-b p-2">Lease start</th>
              <th className="border-b p-2">Lease end</th>
              <th className="border-b p-2">Options</th>
              <th className={`border-b p-2 ${num}`}>PSM</th>
              <th className="border-b p-2 text-left w-[280px]">Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {linesFiltered.map((l, i) => {
              const rowKey  = `${l.asset}::${l.tenantId}::${l.gla_m2 ?? ""}::${l.lease_start ?? ""}::${l.lease_end ?? ""}::${i}`;
              const noteKey = noteKeyOf(l);
              const savingThis = !!saving[noteKey];

              return (
                <tr key={rowKey} className="text-gray-900">
                  <td className="p-2 whitespace-nowrap" style={{ width: "5%" }}>{l.asset}</td>
                  <td className="p-2 whitespace-nowrap" style={{ width: "1%" }}>
                    {l.tenantLabel ?? prettyFromTenantId(l.tenantId)}
                  </td>
                  <td className={`p-2 ${num} ${V}`}>{fmtInt(l.gla_m2)}</td>
                  <td className={`p-2 ${num}`}>{fmtInt(l.rent_eur_pa)}</td>
                  <td className={`p-2 ${num}`}>{fmt1(l.walt_years)}</td>
                  <td className="p-2 text-center whitespace-nowrap">{fmtDateEU(l.lease_start)}</td>
                  <td className="p-2 text-center whitespace-nowrap">{fmtDateEU(l.lease_end)}</td>
                  <td className="p-2 text-center whitespace-nowrap">{l.options_text || "-"}</td>
                  <td className={`p-2 ${num}`}>{fmt2(l.psm)}</td>
                  <td className="p-2">
                    <input
                      className={`w-full rounded border px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 ${savingThis ? "opacity-60" : ""}`}
                      placeholder="Ajouter une note…"
                      value={notes[noteKey] ?? notes[l.tenantId] ?? ""}
                      onChange={(e) => setNotes((m) => ({ ...m, [noteKey]: e.target.value }))}
                      onBlur={() => saveNote(noteKey, notes[noteKey] ?? "")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                    />
                  </td>
                </tr>
              );
            })}
            {linesFiltered.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={10}>Aucune ligne.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
