"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function AssetDetailPage() {
  const { asset } = useParams<{ asset: string }>();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (asset) {
      fetch(`/api/rr/${asset}`)
        .then((res) => res.json())
        .then(setData);
    }
  }, [asset]);

  if (!data) return <p className="p-4">Chargement…</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">RR Abgleich – {asset}</h1>
      <p className="mb-6">
        ΔRent total: {data.kpis.delta_rent_sum.toLocaleString()} € | Tenants: {data.kpis.tenants_total} | Mismatches: {data.kpis.tenants_mismatch}
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
          {data.lines.map((l: any, i: number) => (
            <tr key={i} className={statusColor(l.status)}>
              <td className="border p-1">{l.tenantId}</td>
              <td className="border p-1">{l.am?.gla_m2 ?? "-"}</td>
              <td className="border p-1">{l.pm?.gla_m2 ?? "-"}</td>
              <td className="border p-1">{l.delta?.gla ?? "-"}</td>
              <td className="border p-1">{l.am?.rent_eur_pa ?? "-"}</td>
              <td className="border p-1">{l.pm?.rent_eur_pa ?? "-"}</td>
              <td className="border p-1">{l.delta?.rent ?? "-"}</td>
              <td className="border p-1">{l.am?.walt_years ?? "-"}</td>
              <td className="border p-1">{l.pm?.walt_years ?? "-"}</td>
              <td className="border p-1">{l.delta?.walt ?? "-"}</td>
              <td className="border p-1 font-semibold">{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function statusColor(status: string) {
  switch (status) {
    case "match": return "bg-green-50";
    case "minor_mismatch": return "bg-yellow-50";
    case "major_mismatch": return "bg-red-50";
    case "missing_on_am": return "bg-blue-50";
    case "missing_on_pm": return "bg-purple-50";
    default: return "";
  }
}
