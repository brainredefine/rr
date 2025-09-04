import { BridgeTenants } from "./types";
import { normalize } from "./normalize";

/**
 * Construit 2 maps :
 * - raw normalisé -> slug canonique (pour fabriquer un tenantId stable)
 * - raw normalisé -> libellé canonique (pour l'affichage)
 *
 * Le JSON ne contient QUE les noms bruts tels qu'ils apparaissent dans tes fichiers.
 * Ici on gère accents/majuscules/ponctuation côté code.
 */
export function makeTenantNormalizer(bridge: BridgeTenants) {
  const nameToCanonicalSlug = new Map<string, string>();
  const nameToCanonicalLabel = new Map<string, string>();

  const slugify = (s: string) => normalize(s); // même normalisation que pour l'ID

  for (const g of bridge.groups) {
    const slug = slugify(g.canonical);
    const label = g.canonical;

    const push = (raw: string) => {
      const key = normalize(raw);
      nameToCanonicalSlug.set(key, slug);
      nameToCanonicalLabel.set(key, label);
    };

    // le canonique lui-même doit matcher
    push(g.canonical);

    for (const nm of g.am ?? []) push(nm);
    for (const nm of g.pm ?? []) push(nm);
  }

  /**
   * Retourne :
   * - slug canonique (pour construire l'ID unique asset::slug)
   * - label canonique (pour l'affichage si besoin)
   * Si non trouvé dans le bridge : on retombe sur le nom normalisé lui-même.
   */
  return {
    toCanonicalSlug(rawName: string): string {
      const key = normalize(rawName);
      return nameToCanonicalSlug.get(key) ?? key;
    },
    toCanonicalLabel(rawName: string): string {
      const key = normalize(rawName);
      return nameToCanonicalLabel.get(key) ?? rawName;
    }
  };
}
