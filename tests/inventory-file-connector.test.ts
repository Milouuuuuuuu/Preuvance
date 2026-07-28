import assert from "node:assert/strict";
import test from "node:test";
import { deflateRawSync } from "node:zlib";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  inferCellType,
  inferColumnType,
  inventoryFile,
  parseCsvLine,
  profileCsvText,
  readXlsxMetadata,
  sniffDelimiter,
  splitCsvRecords,
} from "../lib/inventory/file-inventory";

test("le découpage CSV respecte les guillemets et les guillemets doublés", () => {
  assert.deepEqual(parseCsvLine('a,b,c', ","), ["a", "b", "c"]);
  assert.deepEqual(parseCsvLine('"Durand, Marie",niort', ","), ["Durand, Marie", "niort"]);
  assert.deepEqual(parseCsvLine('"il dit ""oui""",x', ","), ['il dit "oui"', "x"]);
  assert.deepEqual(parseCsvLine("a;b", ";"), ["a", "b"]);
});

test("un saut de ligne entre guillemets ne coupe pas l’enregistrement", () => {
  const records = splitCsvRecords('nom;ville\n"Durand\nMarie";Villeneuve\n');
  assert.equal(records.length, 2);
  assert.equal(records[1], '"Durand\nMarie";Villeneuve');
});

test("le séparateur est déduit de la ligne d’en-tête, point-virgule par défaut", () => {
  assert.equal(sniffDelimiter("a;b;c"), ";");
  assert.equal(sniffDelimiter("a,b,c"), ",");
  assert.equal(sniffDelimiter("a\tb\tc"), "\t");
  assert.equal(sniffDelimiter("colonne_unique"), ";");
});

test("les types de cellules sont déduits de leur forme, jamais conservés", () => {
  assert.equal(inferCellType("2026-07-24"), "date");
  assert.equal(inferCellType("24/07/2026"), "date");
  assert.equal(inferCellType("42"), "entier");
  assert.equal(inferCellType("15200,50"), "décimal");
  assert.equal(inferCellType("oui"), "booléen");
  assert.equal(inferCellType("marie@example.fr"), "texte");
  assert.equal(inferCellType("   "), "vide");

  assert.equal(inferColumnType(["1", "2", "3"]), "entier");
  assert.equal(inferColumnType(["", "", ""]), "vide");
  assert.equal(inferColumnType(["1", "texte"]), "texte");
});

test("le profil CSV rend les en-têtes, le nombre de lignes et les types", () => {
  const profile = profileCsvText(
    "nom;email;montant\nDurand;marie@example.fr;15200,50\nMartin;paul@example.fr;8300,00\n",
  );
  assert.equal(profile.delimiter, ";");
  assert.deepEqual(
    profile.columns.map((column) => column.name),
    ["nom", "email", "montant"],
  );
  assert.equal(profile.columns[2].type, "décimal");
  assert.equal(profile.dataRows, 2);
});

test("une colonne sans en-tête reçoit un nom de position, pas une valeur", () => {
  const profile = profileCsvText("nom;;ville\nDurand;x;Villeneuve\n");
  assert.equal(profile.columns[1].name, "colonne_2");
});

/* Construit un classeur XLSX minimal (archive ZIP non compressée) pour
 * éprouver le lecteur sans dépendance externe. */
function buildXlsx(): Buffer {
  const files: Array<{ name: string; content: string }> = [
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clients" sheetId="1" r:id="rId1"/></sheets></workbook>',
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    },
    {
      name: "xl/sharedStrings.xml",
      content:
        '<?xml version="1.0"?><sst count="3"><si><t>nom</t></si><si><t>email</t></si><si><t>Durand</t></si></sst>',
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content:
        '<?xml version="1.0"?><worksheet><dimension ref="A1:C4"/><sheetData>' +
        '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="inlineStr"><is><t>montant</t></is></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>2</v></c><c r="C2"><v>1520</v></c></row>' +
        "</sheetData></worksheet>",
    },
  ];

  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // méthode 0 : stocké
    local.writeUInt32LE(0, 14); // crc32 non vérifié par le lecteur
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuffer, data);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0, 10);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(nameBuffer.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, nameBuffer);

    offset += local.length + nameBuffer.length + data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([Buffer.concat(locals), centralBuffer, end]);
}

/**
 * Archive minimale d'une seule entrée compressée, dont on contrôle la taille
 * décompressée déclarée : c'est le vecteur de la bombe de décompression.
 */
function buildZipBomb(payloadBytes: number, declaredSize: number): Buffer {
  const name = "xl/workbook.xml";
  const nameBuffer = Buffer.from(name, "utf8");
  const data = deflateRawSync(Buffer.alloc(payloadBytes, 0x20));

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(8, 8); // méthode 8 : deflate
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(nameBuffer.length, 26);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(data.length, 20);
  entry.writeUInt32LE(declaredSize, 24);
  entry.writeUInt16LE(nameBuffer.length, 28);
  entry.writeUInt32LE(0, 42);

  const central = Buffer.concat([entry, nameBuffer]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(30 + nameBuffer.length + data.length, 16);

  return Buffer.concat([local, nameBuffer, data, central, end]);
}

test("une bombe de décompression est refusée, pas décompressée", () => {
  // Près de 4 Go annoncés (maximum d'un champ ZIP32) pour quelques kilo-octets
  // compressés : l'ancien code appelait inflateRawSync sans borne et mourait
  // par épuisement mémoire.
  assert.throws(
    () => readXlsxMetadata(buildZipBomb(64 * 1024, 4_000_000_000)),
    /limite de sécurité/,
  );
});

test("une archive qui ment sur sa taille déclarée est bornée par la décompression elle-même", () => {
  // Taille déclarée honnête (sous la limite), sortie réelle bien plus grande :
  // c'est maxOutputLength qui doit arrêter le flux, pas l'en-tête.
  assert.throws(() => readXlsxMetadata(buildZipBomb(80 * 1024 * 1024, 1_024)), /limite de sécurité/);
});

test("le lecteur XLSX rend les feuilles, les en-têtes et le nombre de lignes", () => {
  const { sheets } = readXlsxMetadata(buildXlsx());
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].name, "Clients");
  assert.deepEqual(
    sheets[0].columns.map((column) => column.name),
    ["nom", "email", "montant"],
  );
  /* La dimension déclare 4 lignes : 3 de données, dont 2 non matérialisées. */
  assert.equal(sheets[0].dataRows, 3);
  assert.equal(sheets[0].rowCountKind, "estimate");
});

test("l’inventaire d’un CSV du disque produit un jeu de données daté et compté", async () => {
  const directory = await mkdtemp(join(tmpdir(), "preuvance-test-"));
  try {
    const path = join(directory, "clients.csv");
    await writeFile(
      path,
      "nom;email;iban\nDurand;marie@example.fr;FR7630006000011234567890189\nMartin;paul@example.fr;FR7630006000011234567890190\n",
      "utf8",
    );

    const outcome = await inventoryFile({ path, sourceId: "exports" });
    assert.equal(outcome.datasets.length, 1);
    const dataset = outcome.datasets[0];
    assert.equal(dataset.name, "clients.csv");
    assert.equal(dataset.kind, "file");
    assert.equal(dataset.rowCount.value, 2);
    assert.equal(dataset.rowCount.kind, "exact");
    assert.equal(dataset.lastChangeSource, "file_mtime");
    assert.deepEqual(
      dataset.fields.map((field) => field.name),
      ["nom", "email", "iban"],
    );
    /* Aucune valeur de cellule ne doit apparaître dans le jeu de données. */
    assert.doesNotMatch(JSON.stringify(dataset), /marie@example\.fr|FR7630006/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("une extension non prise en charge est signalée et non devinée", async () => {
  const directory = await mkdtemp(join(tmpdir(), "preuvance-test-"));
  try {
    const path = join(directory, "notes.docx");
    await writeFile(path, "contenu", "utf8");
    const outcome = await inventoryFile({ path, sourceId: "exports" });
    assert.deepEqual(outcome.datasets, []);
    assert.match(outcome.notes.join(" "), /non prise en charge/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
