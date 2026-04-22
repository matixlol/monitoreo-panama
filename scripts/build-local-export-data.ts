#!/usr/bin/env bun
/**
 * Build a local JSON file that matches the webapp's CSV export payload shape.
 *
 * Intended workflow:
 * 1) Ensure you have `data/entries/*` populated locally (gitignored).
 * 2) Run:
 *    bun run scripts/build-local-export-data.ts
 * 3) This writes `src/data/local-export-data.json` (tracked; deployable to Vercel).
 * 4) The webapp will automatically merge it into the CSV export:
 *    - de-dupe by PDF filename (`name`)
 *    - if both exist, DB validated data wins
 *
 * Options:
 * - --entriesDir <path>  (default: data/entries)
 * - --out <path>         (default: src/data/local-export-data.json)
 * - --pretty             pretty-print JSON
 */

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

type IngressRow = Record<string, unknown> & { pageNumber: number };
type EgressRow = Record<string, unknown> & { pageNumber: number };

type LocalExportDocument = {
  _id: string;
  _creationTime: number;
  name: string;
  pageCount: number;
  status: 'completed';
  errorMessage?: string;
  source: 'official-json';
  sourceModel: null;
  sourceCompletedAt: number | null;
  ingress: IngressRow[];
  egress: EgressRow[];
  candidateName?: string | null;
  candidatePosition?: string | null;
  candidateParty?: string | null;
  candidateProvince?: string | null;
  candidateDistrict?: string | null;
  candidateGender?: string | null;
  candidateId?: string | null;
  postulationId?: string | null;
  isSummary?: boolean | null;
  month?: number | null;
  year?: number | null;
};

type LocalCandidateMetadata = Pick<
  LocalExportDocument,
  | 'candidateName'
  | 'candidatePosition'
  | 'candidateParty'
  | 'candidateProvince'
  | 'candidateDistrict'
  | 'candidateGender'
  | 'candidateId'
  | 'postulationId'
  | 'isSummary'
  | 'month'
  | 'year'
>;

function parseArgs(argv: string[]) {
  const out: { entriesDir: string; outPath: string; pretty: boolean } = {
    entriesDir: 'data/entries',
    outPath: 'src/data/local-export-data.json',
    pretty: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--entriesDir' && argv[i + 1]) {
      out.entriesDir = argv[++i]!;
      continue;
    }
    if (a === '--out' && argv[i + 1]) {
      out.outPath = argv[++i]!;
      continue;
    }
    if (a === '--pretty') {
      out.pretty = true;
      continue;
    }
  }
  return out;
}

function isNonEmptyJsonArray(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.length > 0;
}

function safeDecodeURIComponent(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function filenameFromUrl(url: string) {
  const last = url.split('/').pop() ?? '';
  const noQuery = last.split('?')[0] ?? last;
  return safeDecodeURIComponent(noQuery);
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned.length ? cleaned : null;
}

function normalize(value: unknown): string {
  return (typeof value === 'string' ? value : '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseDetailsToText(details: unknown): string | null {
  if (typeof details !== 'string') return null;
  let html = details;
  // Many entries are serialized like: "\"<p>TEXT</p>\""
  try {
    const parsed = JSON.parse(details);
    if (typeof parsed === 'string') html = parsed;
  } catch {
    // ignore
  }
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
  return text.length ? text : null;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function extractCandidateMetadata(detail: unknown): LocalCandidateMetadata {
  if (!detail || typeof detail !== 'object') {
    return {
      candidateName: null,
      candidatePosition: null,
      candidateParty: null,
      candidateProvince: null,
      candidateDistrict: null,
      candidateGender: null,
    };
  }

  const candidate = (detail as any).Candidate;
  const postulation = (detail as any).Postulation;
  const nameParts = [candidate?.firstName, candidate?.middleName, candidate?.lastName, candidate?.secondLastName]
    .map((part) => cleanText(part))
    .filter((part): part is string => Boolean(part));
  const candidateGender = cleanText(candidate?.gender)?.toLowerCase() ?? null;

  return {
    candidateName: nameParts.length > 0 ? nameParts.join(' ') : null,
    candidatePosition: cleanText(postulation?.Position?.name),
    candidateParty: cleanText((detail as any).Party?.name) ?? cleanText(candidate?.Party?.name),
    candidateProvince: cleanText(postulation?.Province?.name),
    candidateDistrict: cleanText(postulation?.District?.name),
    candidateGender,
    candidateId: cleanText((detail as any).candidateId) ?? cleanText(candidate?.id),
    postulationId: cleanText((detail as any).postulationId) ?? cleanText(postulation?.id),
    isSummary: typeof (detail as any).isSummary === 'boolean' ? (detail as any).isSummary : null,
    month: typeof (detail as any).month === 'number' ? (detail as any).month : null,
    year: typeof (detail as any).year === 'number' ? (detail as any).year : null,
  };
}

async function readJsonIfExists(filePath: string): Promise<unknown | null> {
  try {
    const txt = await readFile(filePath, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

function maxPageNumber(rows: Array<{ pageNumber?: unknown }>): number {
  let max = 0;
  for (const r of rows) {
    const n = typeof r.pageNumber === 'number' ? r.pageNumber : NaN;
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

type OfficialTx = {
  id?: unknown;
  dateSearch?: unknown;
  date?: unknown;
  receiptNumber?: unknown;
  amount?: unknown;
  documentNumber?: unknown;
  name?: unknown;
  checkNumber?: unknown;
  details?: unknown;
  Medium?: unknown;
  Subject?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
};

function toFecha(tx: OfficialTx): string | null {
  const dateSearch = cleanText(tx.dateSearch);
  if (dateSearch) return dateSearch;
  const dateIso = cleanText(tx.date);
  if (dateIso) return dateIso.slice(0, 10);
  return null;
}

function getMediumName(tx: OfficialTx): string {
  if (!tx.Medium || typeof tx.Medium !== 'object') return '';
  return normalize((tx.Medium as any).name);
}

function getSubjectName(tx: OfficialTx): string {
  if (!tx.Subject || typeof tx.Subject !== 'object') return '';
  return normalize((tx.Subject as any).name);
}

function getSubjectIsDonation(tx: OfficialTx): boolean {
  if (!tx.Subject || typeof tx.Subject !== 'object') return false;
  return (tx.Subject as any).isDonation === true;
}

function pagoTipoFromMediumName(mediumName: string): 'Efectivo' | 'Especie' | 'Cheque' | null {
  if (!mediumName) return null;
  if (mediumName.includes('efectivo')) return 'Efectivo';
  if (mediumName.includes('especie')) return 'Especie';
  // Cheque / ACH / Transferencia map best to Cheque for this CSV schema.
  return 'Cheque';
}

function categorizeIngressAmount(subjectName: string, isDonation: boolean, mediumName: string, amount: number) {
  const out: Partial<Record<string, number>> = {};
  const isEspecie = mediumName.includes('especie') || subjectName.includes('especie');
  const isEfectivo = mediumName.includes('efectivo');
  const isChequeAch = mediumName.includes('cheque') || mediumName.includes('ach') || mediumName.includes('transfer');

  const isRecursosPropios = subjectName.includes('recurso') && subjectName.includes('propio');

  if (isDonation || subjectName.includes('donacion')) {
    if (isEspecie) out.donacionesPrivadasEspecie = amount;
    else if (isEfectivo) out.donacionesPrivadasEfectivo = amount;
    else out.donacionesPrivadasChequeAch = amount; // default bucket
    return out;
  }

  if (isRecursosPropios) {
    if (isEspecie) out.recursosPropiosEspecie = amount;
    else out.recursosPropiosEfectivoCheque = amount; // default bucket
    return out;
  }

  // Unknown ingress classification: keep only `total`.
  void isChequeAch; // keep for readability; no-op
  return out;
}

function categorizeEgressAmount(subjectName: string, amount: number) {
  const out: Partial<Record<string, number>> = {};

  const pick = (key: string) => {
    out[key] = amount;
  };

  if (subjectName.includes('moviliz')) pick('movilizacion');
  else if (subjectName.includes('combust')) pick('combustible');
  else if (subjectName.includes('hosped')) pick('hospedaje');
  else if (subjectName.includes('activist')) pick('activistas');
  else if (subjectName.includes('caravana') || subjectName.includes('concentr')) pick('caravanaConcentraciones');
  else if (subjectName.includes('comida') || subjectName.includes('brindis')) pick('comidaBrindis');
  else if (subjectName.includes('alquiler') || subjectName.includes('servicios basicos') || subjectName.includes('servicio basico'))
    pick('alquilerLocalServiciosBasicos');
  else if (subjectName.includes('cargo banc')) pick('cargosBancarios');
  else if (subjectName.includes('personaliz') || subjectName.includes('articulos promoc')) pick('personalizacionArticulosPromocionales');
  else if (subjectName.includes('propaganda')) pick('propagandaElectoral');
  else if (subjectName.includes('total gastos propaganda')) pick('totalGastosPropaganda');
  else if (subjectName.includes('total de gastos')) pick('totalDeGastosDePropagandaYCampania');
  else if (subjectName.includes('campana')) pick('totalGastosCampania');
  else pick('totalDeGastosDePropagandaYCampania'); // fallback: keep it somewhere

  return out;
}

async function main() {
  const { entriesDir, outPath, pretty } = parseArgs(process.argv);
  const entriesDirAbs = resolve(entriesDir);
  const outPathAbs = resolve(outPath);

  const entryIds = (await readdir(entriesDirAbs, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const docs: LocalExportDocument[] = [];
  const seenByName = new Set<string>();

  for (const entryId of entryIds) {
    const entryDir = join(entriesDirAbs, entryId);
    const ingressPath = join(entryDir, 'ingress.json');
    const egressPath = join(entryDir, 'egress.json');
    const detail = await readJsonIfExists(join(entryDir, 'detail.json'));

    const ingressRaw = await readJsonIfExists(ingressPath);
    const egressRaw = await readJsonIfExists(egressPath);

    const ingressOfficial: OfficialTx[] = Array.isArray(ingressRaw) ? (ingressRaw as OfficialTx[]) : [];
    const egressOfficial: OfficialTx[] = Array.isArray(egressRaw) ? (egressRaw as OfficialTx[]) : [];

    const ingress: IngressRow[] = ingressOfficial
      .map((tx): IngressRow | null => {
        const amount = typeof tx.amount === 'number' ? tx.amount : null;
        if (amount === null) return null;

        const subjectName = getSubjectName(tx);
        const mediumName = getMediumName(tx);
        const isDonation = getSubjectIsDonation(tx);

        return {
          sourceRowId: cleanText(tx.id),
          pageNumber: 0, // official JSON isn't page-based
          fecha: toFecha(tx),
          reciboNumero: cleanText(tx.receiptNumber),
          contribuyenteNombre: cleanText(tx.name),
          representanteLegal: null,
          cedulaRuc: cleanText(tx.documentNumber),
          numeroCheque: cleanText(tx.checkNumber),
          direccion: null,
          telefono: null,
          correoElectronico: null,
          ...categorizeIngressAmount(subjectName, isDonation, mediumName, amount),
          total: amount,
        };
      })
      .filter((v): v is IngressRow => Boolean(v));

    const egress: EgressRow[] = egressOfficial
      .map((tx): EgressRow | null => {
        const amount = typeof tx.amount === 'number' ? tx.amount : null;
        if (amount === null) return null;

        const subjectName = getSubjectName(tx);
        const mediumName = getMediumName(tx);

        return {
          sourceRowId: cleanText(tx.id),
          pageNumber: 0, // official JSON isn't page-based
          fecha: toFecha(tx),
          numeroFacturaRecibo: cleanText(tx.receiptNumber),
          cedulaRuc: cleanText(tx.documentNumber),
          numeroCheque: cleanText(tx.checkNumber),
          proveedorNombre: cleanText(tx.name),
          detalleGasto: parseDetailsToText(tx.details),
          pagoTipo: pagoTipoFromMediumName(mediumName),
          ...categorizeEgressAmount(subjectName, amount),
        };
      })
      .filter((v): v is EgressRow => Boolean(v));

    // Only include entries that actually have data.
    if (!(isNonEmptyJsonArray(ingress) || isNonEmptyJsonArray(egress))) continue;

    // Try to determine PDF filename(s) for this entry.
    let pdfNames: string[] = [];
    const candidateMetadata = extractCandidateMetadata(detail);

    try {
      const pdfDir = join(entryDir, 'pdfs');
      const pdfFiles = await readdir(pdfDir, { withFileTypes: true });
      pdfNames = pdfFiles
        .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.pdf'))
        .map((d) => d.name);
    } catch {
      // ignore
    }

    if (pdfNames.length === 0) {
      const affidavitDocs =
        detail && typeof detail === 'object' && Array.isArray((detail as any).AffidavitDocument)
          ? ((detail as any).AffidavitDocument as unknown[])
          : [];
      const fromUrls = affidavitDocs
        .map((d) =>
          d && typeof d === 'object' && typeof (d as any).url === 'string' ? filenameFromUrl((d as any).url) : null,
        )
        .filter((n): n is string => typeof n === 'string' && n.toLowerCase().endsWith('.pdf'));

      pdfNames = [...new Set(fromUrls)];
    }

    if (pdfNames.length === 0) {
      // Fallback: keep it exportable (but it won't match anything by filename).
      pdfNames = [`entry-${entryId}.pdf`];
    }

    let creationTime = 0;
    try {
      const st = await stat(join(entryDir, 'detail.json'));
      creationTime = Math.floor(st.mtimeMs);
    } catch {
      // ignore
    }

    const txCompletedAt =
      Math.max(
        ...[
          ...ingressOfficial.map((t) => parseTimestampMs(t.updatedAt) ?? parseTimestampMs(t.createdAt) ?? 0),
          ...egressOfficial.map((t) => parseTimestampMs(t.updatedAt) ?? parseTimestampMs(t.createdAt) ?? 0),
        ],
      ) || 0;

    const pageCount = Math.max(maxPageNumber(ingress), maxPageNumber(egress));

    for (const name of pdfNames) {
      if (seenByName.has(name)) continue;
      seenByName.add(name);

      docs.push({
        _id: `local:${entryId}:${name}`,
        _creationTime: creationTime,
        name,
        pageCount,
        status: 'completed',
        source: 'official-json',
        sourceModel: null,
        sourceCompletedAt: txCompletedAt || creationTime || null,
        ingress,
        egress,
        ...candidateMetadata,
      });
    }
  }

  const json = pretty ? JSON.stringify(docs, null, 2) : JSON.stringify(docs);
  await writeFile(outPathAbs, json, 'utf8');

  // eslint-disable-next-line no-console
  console.log(`Wrote ${docs.length} docs to ${outPathAbs}`);
}

await main();
