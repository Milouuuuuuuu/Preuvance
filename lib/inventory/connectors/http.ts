/**
 * Surface HTTP minimale partagée par les connecteurs d'API (P1).
 *
 * Volontairement plus étroite que `fetch` : uniquement des GET avec des
 * en-têtes, pas de corps, pas de méthode modifiable. Un connecteur Preuvance
 * ne peut pas écrire dans le système du client, même par accident, et la
 * fonction est injectable donc testable sans réseau.
 */
export type JsonFetch = (
  url: string,
  init?: { headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type JsonGetResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; message: string };

export async function getJson(
  fetchJson: JsonFetch,
  url: string,
  headers: Record<string, string>,
): Promise<JsonGetResult> {
  try {
    const response = await fetchJson(url, { headers });
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `HTTP ${response.status}`,
      };
    }
    return { ok: true, data: await response.json() };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : "erreur réseau inconnue",
    };
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function readText(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export function readBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

export function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

/** Retire toute trace d'identifiant de connexion d'une URL avant journalisation. */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url.split("?")[0];
  }
}
