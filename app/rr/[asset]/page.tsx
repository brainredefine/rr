"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Side = { gla_m2: number; rent_eur_pa: number; walt_years: number };
type Status =
  | "match"
  | "minor_mismatch"
  | "major_mismatch"
  | "missing_on_am"
  | "missing_on_pm";

type DiffLine = {
  tenantId: string;
  tenantLabel?: string;
  am?: Side;
  pm?: Side;
  delta?: { gla: number; rent: number; walt: number };
  status: Status;
};

type DiffResult = {
  kpis: { delta_rent_sum: number; tenants_total: number; tenants_mismatch: number };
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

export default function AssetDetailPage() {
  const { asset } = useParams<{ asset: string }>();
  const [data, setData] = useState<DiffResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!asset) return;
    (async () => {
      try {
        const res = await fetch(`/api/rr/${asset}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: DiffResult = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [asset]);

  if (error) return <p className="p-4 text-red-500">Erreur: {error}</p>;
  if (!data) return <p className="p-4">Chargement…</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">RR Abgleich – {asset}</h1>
      <p className="mb-6">
        ΔRent total: {fmtInt(data.kpis.delta_rent_sum)} € | Tenants: {fmtInt(data.kpis.tenants_total)} | Mismatches:{" "}
        {fmtInt(data.kpis.tenants_mismatch)}
      </p>

      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Tenant</th>
            <th className="border p-2">GLA (AM)</th>
            <th className="border p-2">GLA (PM)</th>
            <th className="border p-2">ΔGLA</th>
            <th className="border p-2">Rent (AM)</th>
            <th className="border p-2">Rent (PM)</th>
            <th className="border p-2">ΔRent</th>
            <th className="border p-2">WALT (AM)</th>
            <th className="border p-2">WALT (PM)</th>
            <th className="border p-2">ΔWALT</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className={statusColor(l.status)}>
              <td className="border p-1">{l.tenantLabel ?? l.tenantId}</td>
              <td className="border p-1 text-center">{fmtInt(l.am?.gla_m2)}</td>
              <td className="border p-1 text-center">{fmtInt(l.pm?.gla_m2)}</td>
              <td className="border p-1 text-center">{fmtInt(l.delta?.gla)}</td>
              <td className="border p-1 text-center">{fmtInt(l.am?.rent_eur_pa)}</td>
              <td className="border p-1 text-center">{fmtInt(l.pm?.rent_eur_pa)}</td>
              <td className="border p-1 text-center">{fmtInt(l.delta?.rent)}</td>
              <td className="border p-1 text-center">{fmt1(l.am?.walt_years)}</td>
              <td className="border p-1 text-center">{fmt1(l.pm?.walt_years)}</td>
              <td className="border p-1 text-center">{fmt1(l.delta?.walt)}</td>
              <td className="border p-1 font-semibold">{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusColor(status: Status) {
  switch (status) {
    case "match":
      return "bg-green-50";
    case "minor_mismatch":
      return "bg-yellow-50";
    case "major_mismatch":
      return "bg-red-50";
    case "missing_on_am":
      return "bg-orange-50";
    case "missing_on_pm":
      return "bg-blue-50";
    default:
      return "";
  }
}
