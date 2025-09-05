export type Thresholds = {
  gla_abs: number; gla_pct: number;
  rent_abs: number; rent_pct: number;
  walt_year: number; major_multiplier: number;
};

export type AMCode = "CFR" | "FKE" | "BKO" | "MSC";

export type BridgeAssets = Record<string, AMCode>;

export type Row = {
  asset_code: string;
  tenant_name: string;
  gla_m2: number;
  rent_eur_pa: number;
  walt_years: number;
  lease_start?: string;   
  lease_end?: string;     
  options_text?: string;  
  psm?: number;     
  city?: string; // ⬅️ NEW 
};

export type BridgeTenantItem = {
  normalized: string;
  am_names: string[];
  pm_names: string[];
};

export type BridgeTenants = {
  version: number;
  groups: {
    canonical: string;
    am: string[];
    pm: string[];
    asset_codes?: string[]; // optionnel si un mapping ne vaut que pour certains assets
  }[];
};

export type Pair = {
  asset: string;
  tenantId: string;
    tenantLabel?: string;      // ex: "Netto"
  am?: Row;
  pm?: Row;
};

export type DiffLine = Pair & {
  delta?: {
    gla: number; gla_pct: number;
    rent: number; rent_pct: number;
    walt: number;
  };
  status: "match" | "minor_mismatch" | "major_mismatch" | "missing_on_am" | "missing_on_pm";
};

export type DiffResult = {
  generated_at: string;
  thresholds: Thresholds;
  lines: DiffLine[];
  kpis: { match_rate: number; tenants_total: number; tenants_mismatch: number; delta_rent_sum: number; };
};
