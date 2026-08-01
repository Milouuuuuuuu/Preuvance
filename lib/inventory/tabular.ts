import { parseCsvLine, sniffDelimiter, splitCsvRecords } from "./file-inventory";

/**
 * Lecture des sorties tabulaires d'un client SQL.
 *
 * Ce module vivait dans `mission-config.ts`. Il en est sorti parce qu'il
 * dépend de `file-inventory`, dont la chaîne d'imports atteint `node:fs` :
 * le schéma de mission devenait donc impossible à charger dans un navigateur,
 * alors que rien dans ce schéma n'a besoin du système de fichiers. La console
 * interne peut désormais valider une mission avec le schéma réel plutôt qu'une
 * copie approximative.
 */

export type TabularFormat = "csv" | "tsv" | "json";

/**
 * Convertit la sortie d'un client SQL en lignes exploitables. Les trois
 * formats couvrent `psql --csv`, `mysql --batch` (TSV) et les pilotes qui
 * savent rendre du JSON.
 */
export function parseTabular(text: string, format: TabularFormat): Record<string, unknown>[] {
  if (format === "json") {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (row): row is Record<string, unknown> =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      );
    }
    return [];
  }

  const records = splitCsvRecords(text.replace(/^\uFEFF/, "")).filter(
    (record) => record.trim() !== "",
  );
  if (records.length === 0) return [];

  const delimiter = format === "tsv" ? "\t" : sniffDelimiter(records[0]);
  const header = parseCsvLine(records[0], delimiter).map((cell) => cell.trim());

  return records.slice(1).map((record) => {
    const cells = parseCsvLine(record, delimiter);
    const row: Record<string, unknown> = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    return row;
  });
}
