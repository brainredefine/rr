import path from "path";

/** data/... dans le repo (lu en lecture seule sur Vercel) */
export function dataPath(...segments: string[]) {
  return path.join(process.cwd(), "data", ...segments);
}

/** fichier de données principal, override possible via ENV */
export function resolveDataFile(defaultName: string) {
  const name = process.env.DATA_FILE ?? defaultName; // ex: "am.xlsx" ou "am.csv"
  return dataPath(name);
}
