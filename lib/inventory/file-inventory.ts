import { createReadStream } from "node:fs";
import { open, readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { inflateRawSync } from "node:zlib";

import {
  toIdentifier,
  type CatalogueDataset,
  type CatalogueField,
} from "./catalogue-contract";

/**
 * Connecteur fichiers (P0) : CSV/TSV et classeurs XLSX.
 *
 * Il couvre tous les systèmes fermés qui savent au moins exporter. Ce qui est
 * conservé : nom de la feuille ou du fichier, en-têtes de colonnes, nombre de
 * lignes, type dominant par colonne, taille et date de modification. Ce qui
 * n'est jamais conservé : une seule valeur de cellule. Les valeurs sont lues
 * en mémoire le temps de déduire un type, puis abandonnées.
 */
export const FILE_INVENTORY_VERSION = "preuvance-file-inventory-v1";

export const FILE_INVENTORY_PRIVACY_NOTE =
  "Les fichiers sont lus localement pour en extraire les en-têtes, le nombre de lignes et le type dominant par colonne. Aucune valeur de cellule n’est écrite dans le catalogue.";

const CSV_DELIMITERS = [",", ";", "\t", "|"] as const;
export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];

/** Taille au-delà de laquelle un classeur n'est pas décompressé en mémoire. */
export const MAX_XLSX_BYTES = 200 * 1024 * 1024;
/** Lignes échantillonnées pour deviner le type d'une colonne. */
export const TYPE_SAMPLE_ROWS = 200;

export const COLUMN_TYPES = [
  "entier",
  "décimal",
  "date",
  "booléen",
  "texte",
  "vide",
] as const;
export type ColumnType = (typeof COLUMN_TYPES)[number];

/**
 * Découpe une ligne CSV en respectant les guillemets doublés (RFC 4180).
 * Écrit à la main : la dépendance externe n'apporterait rien et ce code doit
 * tourner sur le poste du client sans installation.
 */
export function parseCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (inQuotes) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === delimiter) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

/**
 * Choisit le séparateur qui découpe la première ligne en le plus de colonnes,
 * hors guillemets. Un point-virgule l'emporte sur la virgule à égalité : les
 * exports français en produisent massivement.
 */
export function sniffDelimiter(headerLine: string): CsvDelimiter {
  let best: CsvDelimiter = ",";
  let bestCount = 0;
  for (const delimiter of CSV_DELIMITERS) {
    const count = parseCsvLine(headerLine, delimiter).length;
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  if (bestCount <= 1) return ";";
  return best;
}

const INTEGER_PATTERN = /^[+-]?\d{1,15}$/;
const DECIMAL_PATTERN = /^[+-]?\d{1,15}([.,]\d{1,10})$/;
const BOOLEAN_PATTERN = /^(true|false|vrai|faux|oui|non|0|1|y|n|o)$/i;
const DATE_PATTERN =
  /^(\d{4}-\d{2}-\d{2}([ T]\d{2}:\d{2}(:\d{2})?)?|\d{2}\/\d{2}\/\d{4}|\d{2}-\d{2}-\d{4})$/;

/** Type d'une cellule, déduit de sa forme. La valeur elle-même n'est pas conservée. */
export function inferCellType(value: string): ColumnType {
  const trimmed = value.trim();
  if (trimmed === "") return "vide";
  if (DATE_PATTERN.test(trimmed)) return "date";
  if (INTEGER_PATTERN.test(trimmed)) return "entier";
  if (DECIMAL_PATTERN.test(trimmed)) return "décimal";
  if (BOOLEAN_PATTERN.test(trimmed)) return "booléen";
  return "texte";
}

/** Type dominant d'une colonne : le plus fréquent hors cellules vides. */
export function inferColumnType(samples: readonly string[]): ColumnType {
  const counts = new Map<ColumnType, number>();
  for (const sample of samples) {
    const type = inferCellType(sample);
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  const ranked = [...counts.entries()]
    .filter(([type]) => type !== "vide")
    .sort((a, b) => b[1] - a[1] || COLUMN_TYPES.indexOf(a[0]) - COLUMN_TYPES.indexOf(b[0]));
  if (ranked.length === 0) return "vide";
  const [dominant] = ranked;
  const mixed = ranked.length > 1 && ranked[0][1] === ranked[1][1];
  return mixed ? "texte" : dominant[0];
}

export type CsvProfile = {
  delimiter: CsvDelimiter;
  columns: Array<{ name: string; type: ColumnType }>;
  dataRows: number;
  truncatedSample: boolean;
};

/**
 * Profile un CSV déjà chargé en mémoire (utilisé par les tests et par les
 * petits fichiers). Les lignes physiques sont recollées quand une valeur
 * entre guillemets contient un retour à la ligne.
 */
export function profileCsvText(text: string): CsvProfile {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const records = splitCsvRecords(withoutBom);
  const headerLine = records[0] ?? "";
  const delimiter = sniffDelimiter(headerLine);
  const header = parseCsvLine(headerLine, delimiter).map((cell, index) =>
    cell.trim() === "" ? `colonne_${index + 1}` : cell.trim(),
  );

  const samples: string[][] = header.map(() => []);
  let dataRows = 0;
  for (let index = 1; index < records.length; index += 1) {
    const record = records[index];
    if (record.trim() === "") continue;
    dataRows += 1;
    if (dataRows > TYPE_SAMPLE_ROWS) continue;
    const cells = parseCsvLine(record, delimiter);
    for (let column = 0; column < header.length; column += 1) {
      samples[column].push(cells[column] ?? "");
    }
  }

  return {
    delimiter,
    columns: header.map((name, index) => ({
      name,
      type: inferColumnType(samples[index] ?? []),
    })),
    dataRows,
    truncatedSample: dataRows > TYPE_SAMPLE_ROWS,
  };
}

/** Découpe en enregistrements logiques : un saut de ligne entre guillemets n'en est pas un. */
export function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') {
        current += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
      continue;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      records.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current !== "") records.push(current);
  return records;
}

/* --------------------------------------------------------------------------
 * Lecture XLSX sans dépendance : un classeur est une archive ZIP de XML.
 * On y lit uniquement la liste des feuilles, la première ligne (en-têtes) et
 * la dimension déclarée (nombre de lignes).
 * ----------------------------------------------------------------------- */

type ZipEntry = {
  name: string;
  method: number;
  offset: number;
  compressedSize: number;
  uncompressedSize: number;
};

/**
 * Borne dure de décompression d'une entrée ZIP. Le plafond MAX_XLSX_BYTES ne
 * borne que le fichier compressé : un classeur piégé au ratio 1000:1 ferait
 * sinon allouer des dizaines de gigaoctets par inflateRawSync et tuerait
 * l'agent par épuisement mémoire en pleine collecte. La taille déclarée par
 * l'archive est vérifiée d'abord, mais c'est `maxOutputLength` qui fait foi :
 * une archive peut mentir sur sa taille déclarée, pas sur sa sortie réelle.
 */
const MAX_XLSX_TEXT_BYTES = 64 * 1024 * 1024;

function readZipDirectory(buffer: Buffer): ZipEntry[] {
  const signature = 0x06054b50;
  let end = -1;
  for (let index = buffer.length - 22; index >= 0 && index > buffer.length - 66_000; index -= 1) {
    if (buffer.readUInt32LE(index) === signature) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("archive XLSX illisible : fin d’archive ZIP introuvable");

  const entryCount = buffer.readUInt16LE(end + 10);
  let cursor = buffer.readUInt32LE(end + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const offset = buffer.readUInt32LE(cursor + 42);
    const name = buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength);
    entries.push({ name, method, offset, compressedSize, uncompressedSize });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function readZipEntry(buffer: Buffer, entry: ZipEntry): string {
  if (buffer.readUInt32LE(entry.offset) !== 0x04034b50) {
    throw new Error(`entrée ZIP « ${entry.name} » corrompue`);
  }
  const nameLength = buffer.readUInt16LE(entry.offset + 26);
  const extraLength = buffer.readUInt16LE(entry.offset + 28);
  const start = entry.offset + 30 + nameLength + extraLength;
  const raw = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return raw.toString("utf8");
  if (entry.method === 8) {
    if (entry.uncompressedSize > MAX_XLSX_TEXT_BYTES) {
      throw new Error(
        `entrée ZIP « ${entry.name} » refusée : taille décompressée déclarée (${entry.uncompressedSize} octets) au-delà de la limite de sécurité`,
      );
    }
    try {
      return inflateRawSync(raw, { maxOutputLength: MAX_XLSX_TEXT_BYTES }).toString("utf8");
    } catch {
      throw new Error(
        `entrée ZIP « ${entry.name} » refusée : décompression au-delà de la limite de sécurité (${MAX_XLSX_TEXT_BYTES} octets) ou flux corrompu`,
      );
    }
  }
  throw new Error(`compression ZIP non gérée (méthode ${entry.method}) pour « ${entry.name} »`);
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&");
}

/**
 * Résout uniquement les chaînes partagées effectivement citées par la ligne
 * d'en-tête. Les valeurs métier des autres lignes ne sont donc même pas
 * matérialisées.
 */
function readSharedStrings(xml: string, neededIndexes: ReadonlySet<number>): Map<number, string> {
  const resolved = new Map<number, string>();
  if (neededIndexes.size === 0) return resolved;
  const maxIndex = Math.max(...neededIndexes);
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = itemPattern.exec(xml)) !== null) {
    if (neededIndexes.has(index)) {
      const parts = [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]);
      resolved.set(index, decodeXmlText(parts.join("")));
    }
    index += 1;
    if (index > maxIndex) break;
  }
  return resolved;
}

function columnLetterToIndex(reference: string): number {
  const letters = reference.replace(/\d+/g, "").toUpperCase();
  let value = 0;
  for (const letter of letters) {
    value = value * 26 + (letter.charCodeAt(0) - 64);
  }
  return value - 1;
}

export type XlsxSheetProfile = {
  name: string;
  columns: Array<{ name: string; type: ColumnType }>;
  dataRows: number;
  rowCountKind: "exact" | "estimate";
};

/** Extrait les métadonnées d'un classeur : feuilles, en-têtes, nombre de lignes. */
export function readXlsxMetadata(buffer: Buffer): {
  sheets: XlsxSheetProfile[];
  notes: string[];
} {
  const notes: string[] = [];
  const entries = readZipDirectory(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  const workbookEntry = byName.get("xl/workbook.xml");
  if (!workbookEntry) throw new Error("classeur XLSX sans xl/workbook.xml");
  const workbookXml = readZipEntry(buffer, workbookEntry);

  const relsEntry = byName.get("xl/_rels/workbook.xml.rels");
  const relations = new Map<string, string>();
  if (relsEntry) {
    const relsXml = readZipEntry(buffer, relsEntry);
    for (const match of relsXml.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /Id="([^"]+)"/.exec(match[0])?.[1];
      const target = /Target="([^"]+)"/.exec(match[0])?.[1];
      if (id && target) {
        relations.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`);
      }
    }
  }

  const sheets: XlsxSheetProfile[] = [];
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*>/g)) {
    const name = decodeXmlText(/name="([^"]*)"/.exec(match[0])?.[1] ?? "");
    const relationId = /r:id="([^"]+)"/.exec(match[0])?.[1] ?? "";
    const target = relations.get(relationId);
    const sheetEntry = target ? byName.get(target) : undefined;
    if (!sheetEntry) {
      notes.push(`Feuille « ${name} » introuvable dans l’archive : ignorée.`);
      continue;
    }
    const sheetXml = readZipEntry(buffer, sheetEntry);
    sheets.push(profileXlsxSheet(name, sheetXml, buffer, byName));
  }

  if (sheets.length === 0) notes.push("Aucune feuille exploitable dans ce classeur.");
  return { sheets, notes };
}

function profileXlsxSheet(
  name: string,
  sheetXml: string,
  buffer: Buffer,
  byName: Map<string, ZipEntry>,
): XlsxSheetProfile {
  const rowMatches = [...sheetXml.matchAll(/<row\b[^>]*>[\s\S]*?<\/row>/g)];
  const headerRow = rowMatches[0]?.[0] ?? "";

  const headerCells = [...headerRow.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map((cell) => ({
    attributes: cell[1],
    body: cell[2],
  }));

  const sharedIndexes = new Set<number>();
  for (const cell of headerCells) {
    if (/t="s"/.test(cell.attributes)) {
      const value = /<v>(\d+)<\/v>/.exec(cell.body)?.[1];
      if (value) sharedIndexes.add(Number(value));
    }
  }
  const sharedEntry = byName.get("xl/sharedStrings.xml");
  const shared = sharedEntry
    ? readSharedStrings(readZipEntry(buffer, sharedEntry), sharedIndexes)
    : new Map<number, string>();

  const columns: Array<{ name: string; type: ColumnType }> = [];
  headerCells.forEach((cell, position) => {
    const reference = /r="([A-Z]+\d+)"/.exec(cell.attributes)?.[1];
    const columnIndex = reference ? columnLetterToIndex(reference) : position;
    let label = "";
    if (/t="s"/.test(cell.attributes)) {
      const value = /<v>(\d+)<\/v>/.exec(cell.body)?.[1];
      label = value ? (shared.get(Number(value)) ?? "") : "";
    } else if (/t="inlineStr"/.test(cell.attributes)) {
      label = decodeXmlText(/<t\b[^>]*>([\s\S]*?)<\/t>/.exec(cell.body)?.[1] ?? "");
    } else {
      label = decodeXmlText(/<v>([\s\S]*?)<\/v>/.exec(cell.body)?.[1] ?? "");
    }
    columns[columnIndex] = {
      name: label.trim() === "" ? `colonne_${columnIndex + 1}` : label.trim(),
      type: "texte",
    };
  });

  for (let index = 0; index < columns.length; index += 1) {
    if (!columns[index]) columns[index] = { name: `colonne_${index + 1}`, type: "texte" };
  }

  /* Le type est déduit du marqueur de type des cellules, pas de leur valeur. */
  const typeCounts = new Map<number, Map<ColumnType, number>>();
  for (let rowIndex = 1; rowIndex < Math.min(rowMatches.length, TYPE_SAMPLE_ROWS + 1); rowIndex += 1) {
    for (const cell of rowMatches[rowIndex][0].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const reference = /r="([A-Z]+\d+)"/.exec(cell[1])?.[1];
      if (!reference) continue;
      const columnIndex = columnLetterToIndex(reference);
      const marker = /t="([a-zA-Z]+)"/.exec(cell[1])?.[1] ?? "n";
      const type: ColumnType =
        marker === "s" || marker === "str" || marker === "inlineStr"
          ? "texte"
          : marker === "b"
            ? "booléen"
            : marker === "d"
              ? "date"
              : "décimal";
      const counts = typeCounts.get(columnIndex) ?? new Map<ColumnType, number>();
      counts.set(type, (counts.get(type) ?? 0) + 1);
      typeCounts.set(columnIndex, counts);
    }
  }
  for (const [columnIndex, counts] of typeCounts) {
    const column = columns[columnIndex];
    if (!column) continue;
    const dominant = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (dominant) column.type = dominant[0];
  }

  const dimension = /<dimension\b[^>]*ref="[A-Z]+\d+:[A-Z]+(\d+)"/.exec(sheetXml)?.[1];
  const declaredRows = dimension ? Number(dimension) : null;
  const countedRows = rowMatches.length;
  const totalRows = declaredRows && declaredRows >= countedRows ? declaredRows : countedRows;

  return {
    name,
    columns,
    dataRows: Math.max(totalRows - 1, 0),
    rowCountKind: declaredRows && declaredRows > countedRows ? "estimate" : "exact",
  };
}

/* --------------------------------------------------------------------------
 * Entrée publique : inventorier un fichier du poste.
 * ----------------------------------------------------------------------- */

/** Lit seulement les premiers octets : un export de plusieurs Go n'est jamais chargé en mémoire. */
async function readHead(path: string, bytes: number): Promise<string> {
  const handle = await open(path, "r");
  try {
    const buffer = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf8");
  } finally {
    await handle.close();
  }
}

async function countCsvRecordsFromFile(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8" });
    let inQuotes = false;
    let records = 0;
    let sawContent = false;
    stream.on("data", (chunk: string | Buffer) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      for (let index = 0; index < text.length; index += 1) {
        const char = text[index];
        if (char === '"') {
          inQuotes = !inQuotes;
          sawContent = true;
          continue;
        }
        if (!inQuotes && char === "\n") {
          records += 1;
          sawContent = false;
          continue;
        }
        if (char !== "\r") sawContent = true;
      }
    });
    stream.on("end", () => resolve(sawContent ? records + 1 : records));
    stream.on("error", reject);
  });
}

export type FileInventoryOutcome = {
  datasets: CatalogueDataset[];
  notes: string[];
  sizeBytes: number;
  modifiedAt: string;
};

/**
 * Inventorie un fichier CSV/TSV ou XLSX et retourne des jeux de données prêts
 * pour le catalogue.
 */
export async function inventoryFile(options: {
  path: string;
  sourceId: string;
  /** Octets lus au maximum pour l'échantillon de types d'un CSV. */
  sampleBytes?: number;
}): Promise<FileInventoryOutcome> {
  const { path, sourceId } = options;
  const stats = await stat(path);
  const modifiedAt = stats.mtime.toISOString();
  const extension = extname(path).toLowerCase();
  const label = basename(path);
  const notes: string[] = [];

  if (extension === ".xlsx" || extension === ".xlsm") {
    if (stats.size > MAX_XLSX_BYTES) {
      return {
        datasets: [],
        notes: [
          `Classeur « ${label} » ignoré : ${Math.round(stats.size / 1_048_576)} Mo dépassent la limite de sécurité de ${MAX_XLSX_BYTES / 1_048_576} Mo.`,
        ],
        sizeBytes: stats.size,
        modifiedAt,
      };
    }
    const buffer = await readFile(path);
    const workbook = readXlsxMetadata(buffer);
    notes.push(...workbook.notes);
    const datasets = workbook.sheets.map((sheet) =>
      toDataset({
        sourceId,
        id: toIdentifier(sourceId, label, sheet.name),
        name: `${label} (${sheet.name})`,
        kind: "sheet",
        columns: sheet.columns,
        rows: sheet.dataRows,
        rowCountKind: sheet.rowCountKind,
        rowCountMethod:
          sheet.rowCountKind === "exact"
            ? "Lignes déclarées par la feuille du classeur."
            : "Dimension déclarée par le classeur, supérieure aux lignes matérialisées.",
        sizeBytes: null,
        modifiedAt,
      }),
    );
    return { datasets, notes, sizeBytes: stats.size, modifiedAt };
  }

  if (extension === ".csv" || extension === ".tsv" || extension === ".txt") {
    const sampleBytes = options.sampleBytes ?? 2 * 1024 * 1024;
    const sample = await readHead(path, sampleBytes);
    const profile = profileCsvText(sample);
    const totalRecords = await countCsvRecordsFromFile(path);
    const dataRows = Math.max(totalRecords - 1, 0);
    if (stats.size > sampleBytes) {
      notes.push(
        `Types de colonnes déduits des ${Math.round(sampleBytes / 1024)} premiers Ko de « ${label} » ; le nombre de lignes, lui, est complet.`,
      );
    }
    return {
      datasets: [
        toDataset({
          sourceId,
          id: toIdentifier(sourceId, label),
          name: label,
          kind: "file",
          columns: profile.columns,
          rows: dataRows,
          rowCountKind: "exact",
          rowCountMethod: `Comptage complet des enregistrements, séparateur « ${profile.delimiter === "\t" ? "tabulation" : profile.delimiter} ».`,
          sizeBytes: stats.size,
          modifiedAt,
        }),
      ],
      notes,
      sizeBytes: stats.size,
      modifiedAt,
    };
  }

  return {
    datasets: [],
    notes: [`Extension « ${extension || "sans extension"} » non prise en charge : « ${label} » ignoré.`],
    sizeBytes: stats.size,
    modifiedAt,
  };
}

function toDataset(options: {
  sourceId: string;
  id: string;
  name: string;
  kind: CatalogueDataset["kind"];
  columns: Array<{ name: string; type: ColumnType }>;
  rows: number;
  rowCountKind: "exact" | "estimate";
  rowCountMethod: string;
  sizeBytes: number | null;
  modifiedAt: string;
}): CatalogueDataset {
  const fields: CatalogueField[] = options.columns.map((column) => ({
    name: column.name,
    dataType: column.type,
  }));
  return {
    id: options.id,
    sourceId: options.sourceId,
    name: options.name,
    kind: options.kind,
    rowCount: {
      value: options.rows,
      kind: options.rowCountKind,
      method: options.rowCountMethod,
    },
    sizeBytes: options.sizeBytes,
    lastChangeAt: options.modifiedAt,
    lastChangeSource: "file_mtime",
    fields,
    notes: [],
  };
}
