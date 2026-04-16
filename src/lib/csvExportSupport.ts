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
  const filteredLocalDocs = filterExportDataByName(localDocs, archivedDocumentNames);
  return enrichCsvExportData(mergeExportData(dbDocs, filteredLocalDocs));
}
