import documentsIndex from '../data/documents-index.json';
import bundledLocalExportData from '../data/local-export-data.json';
import { autofixCsvExportDates } from './csvDateAutofix';
import type { CsvExportDocument } from './csvExport';

type CandidateMetadata = {
  id: string;
  candidateName: string;
  documentId: string;
  position: string;
  party: string;
  province: string | null;
  district: string | null;
  township: string | null;
  candidateGender: string | null;
  status: string;
  isProclaimed: boolean;
  dateSent: string | null;
  totalIngress: number;
  totalEgress: number;
  pdfUrl: string | null;
};

const GENERATED_SPLIT_PDF_SUFFIX_PATTERN = /-split-\d+(?=\.pdf$)/i;

function isCsvExportDocument(value: unknown): value is CsvExportDocument {
  return Boolean(value) && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string';
}

export function normalizeForComparison(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ÃÂ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeFilenameForCandidateLookup(value: string): string {
  return normalizeForComparison(value).replace(GENERATED_SPLIT_PDF_SUFFIX_PATTERN, '');
}

export function findCandidateByFilename(filename: string): CandidateMetadata | null {
  const normalizedFilename = normalizeFilenameForCandidateLookup(filename);

  for (const candidate of documentsIndex as CandidateMetadata[]) {
    if (!candidate.pdfUrl) continue;

    let pdfFilename = candidate.pdfUrl.split('/').pop() || '';
    try {
      pdfFilename = decodeURIComponent(decodeURIComponent(pdfFilename));
    } catch {
      try {
        pdfFilename = decodeURIComponent(pdfFilename);
      } catch {
        // Keep the raw filename when decoding fails.
      }
    }

    if (normalizeFilenameForCandidateLookup(pdfFilename) === normalizedFilename) {
      return candidate;
    }
  }

  return null;
}

export function getBundledLocalExportAugmentation(): CsvExportDocument[] {
  return Array.isArray(bundledLocalExportData)
    ? bundledLocalExportData.filter(isCsvExportDocument).map((doc) => doc as CsvExportDocument)
    : [];
}

function getSummaryFilterGroupKey(doc: CsvExportDocument): string | null {
  if (doc.postulationId) return `postulation:${doc.postulationId}`;
  if (doc.candidateId) return `candidate:${doc.candidateId}`;

  const candidateName = normalizeForComparison(doc.candidateName ?? '');
  const position = normalizeForComparison(doc.candidatePosition ?? '');
  const party = normalizeForComparison(doc.candidateParty ?? '');
  const province = normalizeForComparison(doc.candidateProvince ?? '');
  const district = normalizeForComparison(doc.candidateDistrict ?? '');

  if (!candidateName) return null;
  return `fallback:${candidateName}|${position}|${party}|${province}|${district}`;
}

function normalizeSignatureValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return normalizeForComparison(value);
  return String(value).trim();
}

function makeIngressRowSignature(row: NonNullable<CsvExportDocument['ingress']>[number]): string {
  return [
    row.reciboNumero,
    row.contribuyenteNombre,
    row.representanteLegal,
    row.cedulaRuc,
    row.direccion,
    row.telefono,
    row.correoElectronico,
    row.donacionesPrivadasEfectivo,
    row.donacionesPrivadasChequeAch,
    row.donacionesPrivadasEspecie,
    row.recursosPropiosEfectivoCheque,
    row.recursosPropiosEspecie,
    row.total,
  ]
    .map(normalizeSignatureValue)
    .join('|');
}

function makeEgressRowSignature(row: NonNullable<CsvExportDocument['egress']>[number]): string {
  return [
    row.numeroFacturaRecibo,
    row.cedulaRuc,
    row.proveedorNombre,
    row.detalleGasto,
    row.detalleGastoResumido,
    row.GastoCategoria,
    row.pagoTipo,
    row.movilizacion,
    row.combustible,
    row.hospedaje,
    row.activistas,
    row.caravanaConcentraciones,
    row.comidaBrindis,
    row.alquilerLocalServiciosBasicos,
    row.cargosBancarios,
    row.totalGastosCampania,
    row.personalizacionArticulosPromocionales,
    row.propagandaElectoral,
    row.totalGastosPropaganda,
    row.totalDeGastosDePropagandaYCampania,
  ]
    .map(normalizeSignatureValue)
    .join('|');
}

function isCoveredBySet(signatures: string[], covered: Set<string>): boolean {
  return signatures.length > 0 && signatures.every((signature) => covered.has(signature));
}

function dropRedundantLocalSummaryDocs(localDocs: CsvExportDocument[]): CsvExportDocument[] {
  const docsByGroup = new Map<string, CsvExportDocument[]>();

  for (const doc of localDocs) {
    const key = getSummaryFilterGroupKey(doc);
    if (!key) continue;

    const group = docsByGroup.get(key);
    if (group) group.push(doc);
    else docsByGroup.set(key, [doc]);
  }

  const redundantIdsToDrop = new Set<string>();
  for (const group of docsByGroup.values()) {
    const keptIngressSignatures = new Set<string>();
    const keptEgressSignatures = new Set<string>();

    const sortedGroup = [...group].sort((a, b) => {
      const aRowCount = (a.ingress?.length ?? 0) + (a.egress?.length ?? 0);
      const bRowCount = (b.ingress?.length ?? 0) + (b.egress?.length ?? 0);
      if (aRowCount !== bRowCount) return aRowCount - bRowCount;
      if (a._creationTime !== b._creationTime) return a._creationTime - b._creationTime;
      return a.name.localeCompare(b.name);
    });

    for (const doc of sortedGroup) {
      const ingressSignatures = (doc.ingress ?? []).map(makeIngressRowSignature);
      const egressSignatures = (doc.egress ?? []).map(makeEgressRowSignature);

      const ingressCovered = ingressSignatures.length === 0 || isCoveredBySet(ingressSignatures, keptIngressSignatures);
      const egressCovered = egressSignatures.length === 0 || isCoveredBySet(egressSignatures, keptEgressSignatures);

      if ((ingressSignatures.length > 0 || egressSignatures.length > 0) && ingressCovered && egressCovered) {
        redundantIdsToDrop.add(doc._id);
        continue;
      }

      for (const signature of ingressSignatures) keptIngressSignatures.add(signature);
      for (const signature of egressSignatures) keptEgressSignatures.add(signature);
    }
  }

  if (redundantIdsToDrop.size === 0) return localDocs;
  return localDocs.filter((doc) => !redundantIdsToDrop.has(doc._id));
}

export function filterExportDataByName(
  docs: CsvExportDocument[],
  excludedNames: Iterable<string>,
): CsvExportDocument[] {
  const excluded = new Set([...excludedNames].map(normalizeForComparison));
  if (excluded.size === 0) return docs;
  return docs.filter((doc) => !excluded.has(normalizeForComparison(doc.name)));
}

export function mergeExportData(dbDocs: CsvExportDocument[], localDocs: CsvExportDocument[]): CsvExportDocument[] {
  const localByName = new Map<string, CsvExportDocument>();
  for (const doc of localDocs) {
    if (!localByName.has(doc.name)) localByName.set(doc.name, doc);
  }

  const merged: CsvExportDocument[] = [];
  for (const doc of dbDocs) {
    const local = localByName.get(doc.name);
    if (!local) {
      merged.push(doc);
      continue;
    }

    merged.push(doc.source === 'validated' ? doc : local);
    localByName.delete(doc.name);
  }

  merged.push(...localByName.values());
  return merged;
}

export function enrichCsvExportData(exportData: CsvExportDocument[]): CsvExportDocument[] {
  return autofixCsvExportDates(
    exportData.map((doc) => {
      const candidate = findCandidateByFilename(doc.name);
      return {
        ...doc,
        pdfUrl: candidate?.pdfUrl ?? doc.pdfUrl ?? null,
        candidateName: candidate?.candidateName ?? doc.candidateName ?? null,
        candidatePosition: candidate?.position ?? doc.candidatePosition ?? null,
        candidateParty: candidate?.party ?? doc.candidateParty ?? null,
        candidateProvince: candidate?.province ?? doc.candidateProvince ?? null,
        candidateDistrict: candidate?.district ?? doc.candidateDistrict ?? null,
        candidateGender: candidate?.candidateGender ?? doc.candidateGender ?? null,
      };
    }),
  );
}

export function buildCsvExportPayload(
  dbDocs: CsvExportDocument[],
  localDocs: CsvExportDocument[],
  archivedDocumentNames: Iterable<string> = [],
): CsvExportDocument[] {
  const filteredLocalDocs = dropRedundantLocalSummaryDocs(filterExportDataByName(localDocs, archivedDocumentNames));
  return enrichCsvExportData(mergeExportData(dbDocs, filteredLocalDocs));
}
